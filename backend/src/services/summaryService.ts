import pool from '../db'
import { sendWhatsAppText } from './waha'
import { fechamentoMensal } from './financialAnalytics'
import { claimMessage, releaseMessageClaimIfUndelivered, claimKeyDia, claimKeyMesAnterior } from './messageClaim'
import { formatDateSaoPaulo } from './assetMath'
import { variacaoPeriodo } from './benchmarkMath'
import { contasDaSemana } from './whatsappCommandHandler'
import { carregarCategorias } from './expenseCategoryStore'
import { nomeCategoria } from './expenseCategories'
import { blocoCarteiraSemana, blocoChecklistsSemana, blocoGastosSemana, linhasContas, somarDias } from './whatsappCommands'

function formatBRL(v: number): string {
  return v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// --- Resumo semanal: contas da semana, carteira, checklists e gastos avulsos ---
// As datas saem de São Paulo: o container roda em UTC, e o resumo das 8h BRT
// usando new Date() pegava o mês e a semana certos só por sorte do horário.
export async function sendWeeklySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const hoje = formatDateSaoPaulo(new Date())
  const inicioDoMes = `${hoje.slice(0, 7)}-01`
  const fimDoMes = somarDias(`${proximoMes(hoje)}-01`, -1)

  const [[stats]]: any = await pool.query(
    `SELECT SUM(o.amount) AS total
       FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id
      WHERE b.user_id = ? AND b.is_active = 1 AND o.due_date BETWEEN ? AND ?`,
    [userId, inicioDoMes, fimDoMes]
  )
  const proximas = await contasDaSemana(userId, hoje)

  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''
  let msg = `📊 *Resumo Rotina${firstName}*\n\n`
  msg += `*Total deste mês:* R$ ${formatBRL(Number(stats.total) || 0)}\n`

  if (proximas.length) {
    msg += `\n*Próximos 7 dias:*\n${linhasContas(proximas, hoje).join('\n')}\n`
  } else {
    msg += `\nNenhuma conta nos próximos 7 dias. 🎉\n`
  }

  // Blocos sem dado somem: quem não tem ativo não recebe uma "Carteira" vazia.
  const blocos = [
    await blocoCarteira(userId, hoje),
    await blocoChecklists(userId, hoje),
    await blocoGastos(userId, hoje),
  ].filter(Boolean)
  if (blocos.length) msg += `\n${blocos.join('\n\n')}`

  const refKey = claimKeyDia()
  if (!await claimMessage(userId, 'weekly_summary', refKey)) return

  try {
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  } catch (err) {
    await releaseMessageClaimIfUndelivered(userId, 'weekly_summary', refKey, err)
    throw err
  }
  console.log(`[summary] resumo semanal enviado para ${userId}`)
}

function proximoMes(data: string): string {
  const [ano, mes] = data.split('-').map(Number)
  return mes === 12 ? `${ano + 1}-01` : `${ano}-${String(mes + 1).padStart(2, '0')}`
}

// Variação dos últimos 7 dias, sem contar aporte como ganho.
async function blocoCarteira(userId: string, hoje: string): Promise<string | null> {
  const [rows]: any = await pool.query(
    `SELECT asset_id, DATE_FORMAT(snapshot_date, '%Y-%m-%d') AS date, price, quantity
       FROM asset_snapshots
      WHERE user_id = ? AND snapshot_date >= ?`,
    [userId, somarDias(hoje, -7)]
  )
  return blocoCarteiraSemana(variacaoPeriodo(rows.map((r: any) => ({
    assetId: r.asset_id,
    date: r.date,
    price: Number(r.price),
    quantity: Number(r.quantity),
  }))))
}

// Os 7 dias fechados antes de hoje: o poll de hoje ainda nem foi respondido às 8h.
async function blocoChecklists(userId: string, hoje: string): Promise<string | null> {
  const [[pollRows], [itemRows]]: any = await Promise.all([
    pool.query(
      `SELECT p.checklist_id, c.name, p.selected_options
       FROM checklist_daily_polls p JOIN checklists c ON c.id = p.checklist_id
      WHERE p.user_id = ? AND p.poll_date BETWEEN ? AND ? AND p.status IN ('sent', 'completed')`,
      [userId, somarDias(hoje, -7), somarDias(hoje, -1)]
    ),
    pool.query(
      `SELECT i.checklist_id, i.text
         FROM checklist_items i JOIN checklists c ON c.id = i.checklist_id
        WHERE c.user_id = ?`,
      [userId]
    ),
  ])
  const itensPorChecklist = new Map<string, string[]>()
  for (const item of itemRows) {
    const itens = itensPorChecklist.get(item.checklist_id) ?? []
    itens.push(item.text)
    itensPorChecklist.set(item.checklist_id, itens)
  }
  const lerOpcoes = (valor: unknown): string[] => {
    if (Array.isArray(valor)) return valor.filter((v): v is string => typeof v === 'string')
    if (typeof valor !== 'string' || !valor) return []
    try {
      const parsed = JSON.parse(valor)
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : []
    } catch { return [] }
  }
  return blocoChecklistsSemana(pollRows.map((r: any) => ({
    checklistId: r.checklist_id,
    nome: r.name || 'Checklist',
    marcados: lerOpcoes(r.selected_options),
    itens: itensPorChecklist.get(r.checklist_id) ?? [],
  })))
}

async function blocoGastos(userId: string, hoje: string): Promise<string | null> {
  const [[row]]: any = await pool.query(
    `SELECT COALESCE(SUM(amount), 0) AS total, COUNT(*) AS quantidade
       FROM expenses WHERE user_id = ? AND spent_on BETWEEN ? AND ?`,
    [userId, somarDias(hoje, -7), somarDias(hoje, -1)]
  )
  return blocoGastosSemana(Number(row.total) || 0, Number(row.quantidade) || 0)
}

// --- Sumário mensal (novo): fechamento do mês anterior ---
export async function sendMonthlySummary(userId: string): Promise<void> {
  const [userRows]: any = await pool.query(
    'SELECT whatsapp_number, name FROM users WHERE id = ? AND is_active = 1 AND whatsapp_alerts_enabled = 1',
    [userId]
  )
  if (!userRows.length || !userRows[0].whatsapp_number) return

  const now = new Date()
  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  const ano = prev.getFullYear()
  const mes = prev.getMonth() + 1

  const fechamento = await fechamentoMensal(userId, ano, mes)
  if (fechamento.qtdContas === 0 && fechamento.qtdGastos === 0) return // nada a reportar

  const nomesMes = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
  const firstName = userRows[0].name ? `, ${userRows[0].name.split(' ')[0]}` : ''

  let msg = `📅 *Fechamento de ${nomesMes[mes - 1]}${firstName}*\n\n`
  msg += `*Contas:* R$ ${formatBRL(fechamento.total)} em ${fechamento.qtdContas} conta(s)\n`
  if (fechamento.qtdGastos > 0) {
    msg += `*Gastos avulsos:* R$ ${formatBRL(fechamento.gastosAvulsos)} em ${fechamento.qtdGastos} lançamento(s)\n`
  }

  if (fechamento.porCategoria.length) {
    // Nome que o usuário deu (categoria criada ou renomeada), não a chave crua.
    const categorias = await carregarCategorias(userId)
    msg += `\n*Contas por categoria:*\n`
    for (const c of fechamento.porCategoria) {
      const nome = nomeCategoria(c.category, categorias)
      msg += `• ${nome}: R$ ${formatBRL(c.total)}\n`
    }
  }

  // Contas e gastos têm limites separados; cada um é julgado contra o seu.
  const linhaOrcamento = (rotulo: string, total: number, limite: number): string => {
    const diff = total - limite
    return diff > 0
      ? `⚠️ ${rotulo}: R$ ${formatBRL(diff)} acima do limite de R$ ${formatBRL(limite)}.\n`
      : `✅ ${rotulo}: dentro do limite de R$ ${formatBRL(limite)}.\n`
  }
  if (fechamento.orcamento != null || fechamento.orcamentoGastos != null) {
    msg += `\n`
    if (fechamento.orcamento != null) msg += linhaOrcamento('Contas', fechamento.total, fechamento.orcamento)
    if (fechamento.orcamentoGastos != null) msg += linhaOrcamento('Gastos', fechamento.gastosAvulsos, fechamento.orcamentoGastos)
    msg = msg.trimEnd()
  }

  const refKey = claimKeyMesAnterior()
  if (!await claimMessage(userId, 'monthly_summary', refKey)) return

  try {
    await sendWhatsAppText(userRows[0].whatsapp_number, msg)
  } catch (err) {
    await releaseMessageClaimIfUndelivered(userId, 'monthly_summary', refKey, err)
    throw err
  }
  console.log(`[summary] sumário mensal enviado para ${userId}`)
}
