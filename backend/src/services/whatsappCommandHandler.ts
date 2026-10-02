import crypto from 'crypto'
import pool from '../db'
import { sendTextToChat, resolveLid } from './waha'
import { fetchQuote } from './quotes'
import { formatDateSaoPaulo } from './assetMath'
import { variacaoPeriodo, SnapshotDoDia } from './benchmarkMath'
import { claimMessage, releaseMessageClaim, releaseMessageClaimIfUndelivered } from './messageClaim'
import {
  Comando,
  ContaAVencer,
  PollDeHoje,
  PollParaMarcar,
  acharItem,
  argumentosDoComando,
  candidatosDoRemetente,
  ehGrupo,
  idDaMensagem,
  lerListaJson,
  parseComando,
  parseGasto,
  somarDias,
  textoAjuda,
  textoCarteira,
  textoContas,
  textoDaMensagem,
  textoGastoAnotado,
  textoHoje,
  textoItemAmbiguo,
  textoItemNaoEncontrado,
  textoJaMarcado,
  textoMarcado,
  textoUsoGasto,
  textoUsoMarcar,
  unirMarcados,
} from './whatsappCommands'

/**
 * Comandos por WhatsApp: o evento `message` do WAHA chega aqui pelo webhook.
 * Só texto começando com "/" vindo de um usuário do app recebe resposta; o
 * resto é ignorado em silêncio.
 */
export async function handleIncomingMessage(data: any): Promise<void> {
  // fromMe são as próprias mensagens do bot — responder a elas seria um laço.
  if (data?.fromMe || ehGrupo(data)) return

  const textoRecebido = textoDaMensagem(data)
  const comando = parseComando(textoRecebido)
  if (!comando || textoRecebido === null) return

  const mensagemId = idDaMensagem(data)
  const chatId = typeof data?.from === 'string' ? data.from : null
  if (!mensagemId || !chatId) {
    console.warn('[comandos] mensagem sem id ou remetente — ignorada')
    return
  }

  const userId = await acharUsuario(data)
  if (!userId) {
    console.log(`[comandos] ${comando} de remetente que não é usuário do app — ignorado`)
    return
  }

  // Id da mensagem pode passar dos 60 caracteres de ref_key; o hash cabe e
  // continua único por mensagem. A trava vem antes da resposta porque /gasto e
  // /marcar gravam: reentrega do webhook não pode anotar o gasto duas vezes.
  const refKey = crypto.createHash('sha256').update(mensagemId).digest('hex').slice(0, 40)
  if (!await claimMessage(userId, 'command_reply', refKey)) return

  let texto: string
  try {
    texto = await montarResposta(comando, userId, argumentosDoComando(textoRecebido), refKey)
  } catch (err) {
    // Nada foi gravado nem enviado: a reentrega pode tentar de novo.
    await releaseMessageClaim(userId, 'command_reply', refKey)
    throw err
  }

  try {
    await sendTextToChat(chatId, texto)
  } catch (err) {
    await releaseMessageClaimIfUndelivered(userId, 'command_reply', refKey, err)
    throw err
  }
  console.log(`[comandos] /${comando} respondido para ${userId}`)
}

async function buscarUsuario(candidatos: string[]): Promise<string | null> {
  if (candidatos.length === 0) return null
  const [rows]: any = await pool.query(
    `SELECT id FROM users WHERE is_active = 1 AND whatsapp_number IN (${candidatos.map(() => '?').join(', ')}) LIMIT 1`,
    candidatos,
  )
  return rows[0]?.id ?? null
}

async function acharUsuario(data: any): Promise<string | null> {
  const candidatos = candidatosDoRemetente(data)
  const achado = await buscarUsuario(candidatos)
  if (achado) return achado

  // Chat por LID sem telefone no payload e usuário gravado pelo telefone:
  // o WAHA sabe o número por trás do LID.
  for (const lid of candidatos.filter((c) => c.endsWith('@lid'))) {
    const pn = await resolveLid(lid)
    if (!pn) continue
    const porTelefone = await buscarUsuario(candidatosDoRemetente({ from: pn }))
    if (porTelefone) return porTelefone
  }
  return null
}

async function montarResposta(comando: Comando, userId: string, args: string, refKey: string): Promise<string> {
  const hoje = formatDateSaoPaulo(new Date())
  switch (comando) {
    case 'contas':
      return textoContas(await contasDaSemana(userId, hoje), hoje)
    case 'carteira':
      return textoCarteira(await carteiraAgora(userId, hoje), hoje)
    case 'hoje':
      return textoHoje(await pollsDeHoje(userId, hoje))
    case 'gasto':
      return anotarGasto(userId, args, hoje, refKey)
    case 'marcar':
      return marcarItem(userId, args, hoje)
    case 'ajuda':
      return textoAjuda()
    case 'desconhecido':
      return textoAjuda(true)
  }
}

export async function contasDaSemana(userId: string, hoje: string): Promise<ContaAVencer[]> {
  const [rows]: any = await pool.query(
    `SELECT b.name, DATE_FORMAT(o.due_date, '%Y-%m-%d') AS due_date, o.amount
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?
      ORDER BY o.due_date ASC`,
    [userId, hoje, somarDias(hoje, 7)],
  )
  return rows.map((r: any) => ({ nome: r.name, vencimento: r.due_date, valor: Number(r.amount) || 0 }))
}

async function carteiraAgora(userId: string, hoje: string) {
  const [ativos]: any = await pool.query(
    'SELECT id, ticker, kind, quantity, last_price FROM assets WHERE user_id = ? AND is_active = 1 AND quantity > 0',
    [userId],
  )

  // Cotação ao vivo (com o cache de 10 min das cotações); sem ela, o último
  // preço conhecido. Ativo sem nenhum dos dois fica fora e é avisado.
  const atuais: SnapshotDoDia[] = []
  let semCotacao = 0
  await Promise.all(
    ativos.map(async (a: any) => {
      const quote = await fetchQuote(a.ticker, a.kind)
      const price = quote ? quote.price : a.last_price === null ? null : Number(a.last_price)
      if (price === null || !(price > 0)) {
        semCotacao++
        return
      }
      atuais.push({ assetId: a.id, date: hoje, price, quantity: Number(a.quantity) })
    }),
  )
  const patrimonio = atuais.reduce((s, a) => s + a.price * a.quantity, 0)

  // Compara com o último snapshot antes de hoje: ontem num dia normal, sexta
  // numa segunda. O de hoje (se já saiu) não serve — seria comparar com a manhã.
  const [anteriores]: any = await pool.query(
    `SELECT asset_id, DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS date, price, quantity
       FROM asset_snapshots
      WHERE user_id = ? AND snapshot_date = (
        SELECT MAX(snapshot_date) FROM asset_snapshots WHERE user_id = ? AND snapshot_date < ?
      )`,
    [userId, userId, hoje],
  )
  const base: SnapshotDoDia[] = anteriores.map((r: any) => ({
    assetId: r.asset_id,
    date: r.date,
    price: Number(r.price),
    quantity: Number(r.quantity),
  }))

  const variacao = base.length > 0 && atuais.length > 0 ? variacaoPeriodo([...base, ...atuais]) : null
  return { patrimonio, variacao, semCotacao }
}

async function pollsDeHoje(userId: string, hoje: string): Promise<PollDeHoje[]> {
  const [polls]: any = await pool.query(
    `SELECT p.checklist_id, c.name, p.selected_options
       FROM checklist_daily_polls p JOIN checklists c ON c.id = p.checklist_id
      WHERE p.user_id = ? AND p.poll_date = ?
      ORDER BY c.name`,
    [userId, hoje],
  )
  if (polls.length === 0) return []

  const ids = polls.map((p: any) => p.checklist_id)
  const [itens]: any = await pool.query(
    `SELECT checklist_id, text FROM checklist_items
      WHERE checklist_id IN (${ids.map(() => '?').join(', ')})
      ORDER BY sort_order ASC`,
    ids,
  )

  return polls.map((p: any) => ({
    nome: p.name || 'Checklist',
    itens: itens.filter((i: any) => i.checklist_id === p.checklist_id).map((i: any) => i.text),
    marcados: lerListaJson(p.selected_options),
  }))
}

async function anotarGasto(userId: string, args: string, hoje: string, refKey: string): Promise<string> {
  const gasto = parseGasto(args)
  if (!gasto) return textoUsoGasto()

  // A trava command_reply é liberada quando a resposta comprovadamente não
  // saiu, e aí o WAHA reentrega a mensagem. message_ref faz a reentrega
  // responder de novo sem anotar o gasto pela segunda vez.
  await pool.query(
    `INSERT INTO expenses (user_id, amount, description, category, spent_on, source, message_ref)
     VALUES (?, ?, ?, ?, ?, 'whatsapp', ?)
     ON DUPLICATE KEY UPDATE id = id`,
    [userId, gasto.valor, gasto.descricao, gasto.categoria, hoje, refKey],
  )
  const [[{ total }]]: any = await pool.query(
    'SELECT COALESCE(SUM(amount), 0) AS total FROM expenses WHERE user_id = ? AND spent_on BETWEEN ? AND ?',
    [userId, `${hoje.slice(0, 7)}-01`, hoje],
  )
  console.log(`[comandos] gasto de ${gasto.valor} anotado para ${userId}`)
  return textoGastoAnotado(gasto, Number(total) || 0)
}

async function marcarItem(userId: string, args: string, hoje: string): Promise<string> {
  if (!args) return textoUsoMarcar()

  const [rows]: any = await pool.query(
    `SELECT p.id, p.checklist_id, c.name, p.selected_options, p.command_marked, p.total_count
       FROM checklist_daily_polls p JOIN checklists c ON c.id = p.checklist_id
      WHERE p.user_id = ? AND p.poll_date = ?
      ORDER BY c.name`,
    [userId, hoje],
  )
  if (rows.length === 0) return '✅ Nenhum checklist enviado hoje ainda.'

  const ids = rows.map((r: any) => r.checklist_id)
  const [itens]: any = await pool.query(
    `SELECT checklist_id, text FROM checklist_items
      WHERE checklist_id IN (${ids.map(() => '?').join(', ')})
      ORDER BY sort_order ASC`,
    ids,
  )

  const polls: PollParaMarcar[] = rows.map((r: any) => ({
    pollId: r.id,
    nome: r.name || 'Checklist',
    itens: itens.filter((i: any) => i.checklist_id === r.checklist_id).map((i: any) => i.text),
    marcados: lerListaJson(r.selected_options),
  }))

  const achado = acharItem(polls, args)
  if (achado.tipo === 'nenhum') return textoItemNaoEncontrado(args, polls)
  if (achado.tipo === 'varios') return textoItemAmbiguo(args, achado.opcoes)
  if (achado.jaMarcado) return textoJaMarcado(achado.item, achado.nome)

  const row = rows.find((r: any) => r.id === achado.pollId)
  const poll = polls.find((p) => p.pollId === achado.pollId)!
  const viaComando = [...lerListaJson(row.command_marked), achado.item]
  const marcados = unirMarcados(poll.marcados, viaComando, poll.itens)
  const total = row.total_count || poll.itens.length || 1
  const pct = Math.round((marcados.length / total) * 10000) / 100

  await pool.query(
    `UPDATE checklist_daily_polls
        SET selected_options = ?, command_marked = ?, completed_count = ?, completion_pct = ?, status = ?
      WHERE id = ?`,
    [
      JSON.stringify(marcados),
      JSON.stringify(viaComando),
      marcados.length,
      Math.min(pct, 100),
      marcados.length >= total ? 'completed' : 'sent',
      achado.pollId,
    ],
  )
  console.log(`[comandos] item marcado por mensagem para ${userId}`)
  return textoMarcado(achado.item, achado.nome, marcados.length, total)
}
