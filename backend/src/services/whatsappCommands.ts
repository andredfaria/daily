import { generatePhoneVariant } from './waha'
import type { VariacaoPeriodo } from './benchmarkMath'

/**
 * Parte pura dos comandos por WhatsApp e dos blocos do resumo semanal: ler o
 * comando, descobrir quem mandou e montar o texto. Banco e envio ficam em
 * whatsappCommandHandler.ts / summaryService.ts.
 */

export type Comando = 'contas' | 'carteira' | 'hoje' | 'ajuda' | 'desconhecido'

const COMANDOS: Comando[] = ['contas', 'carteira', 'hoje', 'ajuda']

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '')

/**
 * Só texto começando com "/" é comando. O resto é conversa e o bot fica
 * quieto — o número também recebe "ok" e "obrigado" em resposta aos lembretes.
 * "/algo" que não existe devolve 'desconhecido': quem usou a barra quis falar
 * com o bot, então vale mostrar a ajuda.
 */
export function parseComando(texto: unknown): Comando | null {
  if (typeof texto !== 'string') return null
  const limpo = texto.trim()
  if (!limpo.startsWith('/')) return null
  const palavra = semAcento(limpo.slice(1).split(/\s+/)[0] ?? '').toLowerCase()
  return (COMANDOS as string[]).includes(palavra) ? (palavra as Comando) : 'desconhecido'
}

/** Texto da mensagem, que muda de lugar conforme a engine do WAHA. */
export function textoDaMensagem(data: any): string | null {
  const texto =
    data?.body ??
    data?._data?.Message?.conversation ??
    data?._data?.Message?.extendedTextMessage?.text ??
    data?._data?.message?.conversation ??
    null
  return typeof texto === 'string' ? texto : null
}

/** Id da mensagem, às vezes string, às vezes { _serialized }. */
export function idDaMensagem(data: any): string | null {
  const id = data?.id?._serialized ?? data?.id ?? data?._data?.Info?.ID ?? null
  return typeof id === 'string' && id.length > 0 ? id : null
}

export function ehGrupo(data: any): boolean {
  const from = String(data?.from ?? '')
  return from.endsWith('@g.us') || data?._data?.Info?.IsGroup === true
}

/**
 * Valores de users.whatsapp_number que podem ser deste remetente.
 *
 * Telefone vira só dígitos, mais a variante com/sem o 9º dígito — a mesma
 * tolerância do login. LID entra inteiro (`123@lid`), que é como o usuário
 * vindo do webhook fica gravado. As engines espalham o remetente por campos
 * diferentes (e o GOWS manda o telefone em SenderAlt quando o chat é LID),
 * então todos são lidos.
 */
export function candidatosDoRemetente(data: any): string[] {
  const brutos = [
    data?.from,
    data?.participant,
    data?._data?.Info?.Sender,
    data?._data?.Info?.SenderAlt,
    data?._data?.Info?.Chat,
    data?._data?.key?.remoteJid,
    data?._data?.key?.remoteJidAlt,
    data?._data?.key?.senderPn,
  ]

  const candidatos = new Set<string>()
  for (const bruto of brutos) {
    if (typeof bruto !== 'string' || !bruto.includes('@')) continue
    const [usuario, dominio] = bruto.split('@')
    // "5511...:12@s.whatsapp.net" — o ":12" é o aparelho, não o número.
    const semAparelho = usuario.split(':')[0]

    if (dominio === 'lid') {
      candidatos.add(`${semAparelho}@lid`)
    } else if (dominio === 'c.us' || dominio === 's.whatsapp.net') {
      const digitos = semAparelho.replace(/\D/g, '')
      if (digitos.length < 10) continue
      candidatos.add(digitos)
      const variante = generatePhoneVariant(digitos)
      if (variante) candidatos.add(variante)
    }
  }
  return [...candidatos]
}

// --- Datas ('YYYY-MM-DD', sem fuso: as contas já chegam no dia de São Paulo) ---

export function somarDias(data: string, dias: number): string {
  const [a, m, d] = data.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1, d + dias)).toISOString().slice(0, 10)
}

const ddmm = (data: string): string => `${data.slice(8, 10)}/${data.slice(5, 7)}`

export function formatBRL(v: number): string {
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const comSinal = (v: number, texto: string): string => `${v > 0 ? '+' : v < 0 ? '−' : ''}${texto}`
const pct = (v: number): string => comSinal(v, `${Math.abs(v).toFixed(2).replace('.', ',')}%`)
const brlComSinal = (v: number): string => comSinal(v, formatBRL(Math.abs(v)))

// --- Respostas dos comandos ---

export function textoAjuda(desconhecido = false): string {
  return (
    (desconhecido ? 'Não conheço esse comando. ' : '') +
    '🤖 *Comandos do BillSync*\n\n' +
    '/contas — o que vence nos próximos 7 dias\n' +
    '/carteira — patrimônio e variação do dia\n' +
    '/hoje — itens do checklist ainda não marcados\n' +
    '/ajuda — esta lista'
  )
}

export interface ContaAVencer {
  nome: string
  vencimento: string
  valor: number
}

function rotuloDia(data: string, hoje: string): string {
  if (data === hoje) return 'hoje'
  if (data === somarDias(hoje, 1)) return 'amanhã'
  return ddmm(data)
}

/** Linhas "• Luz — R$ 120,00 (amanhã)", na ordem de vencimento. */
export function linhasContas(contas: ContaAVencer[], hoje: string): string[] {
  return [...contas]
    .sort((a, b) => a.vencimento.localeCompare(b.vencimento))
    .map((c) => `• ${c.nome} — ${formatBRL(c.valor)} (${rotuloDia(c.vencimento, hoje)})`)
}

export function textoContas(contas: ContaAVencer[], hoje: string): string {
  if (contas.length === 0) return '📋 Nenhuma conta vence nos próximos 7 dias. 🎉'
  const total = contas.reduce((s, c) => s + c.valor, 0)
  return (
    '📋 *Contas dos próximos 7 dias*\n\n' +
    linhasContas(contas, hoje).join('\n') +
    `\n\n*Total:* ${formatBRL(total)}`
  )
}

export interface CarteiraAgora {
  patrimonio: number
  /** Variação desde o último snapshot anterior a hoje; null sem histórico. */
  variacao: VariacaoPeriodo | null
  semCotacao: number
}

export function textoCarteira(c: CarteiraAgora, hoje: string): string {
  if (c.patrimonio <= 0 && c.semCotacao === 0) return '💼 Nenhuma posição na carteira.'

  let msg = `💼 *Carteira*\n\n*Patrimônio:* ${formatBRL(c.patrimonio)}`
  if (c.variacao) {
    const desde = c.variacao.inicio === somarDias(hoje, -1) ? 'desde ontem' : `desde ${ddmm(c.variacao.inicio)}`
    msg += `\n*Variação ${desde}:* ${brlComSinal(c.variacao.ganho)} (${pct(c.variacao.pct)})`
  }
  if (c.semCotacao > 0) {
    msg += `\n\n_${c.semCotacao === 1 ? '1 ativo sem cotação ficou' : `${c.semCotacao} ativos sem cotação ficaram`} de fora._`
  }
  return msg
}

export interface PollDeHoje {
  nome: string
  itens: string[]
  marcados: string[]
}

export function textoHoje(polls: PollDeHoje[]): string {
  if (polls.length === 0) return '✅ Nenhum checklist enviado hoje ainda.'

  const blocos = polls.map((p) => {
    const marcados = new Set(p.marcados)
    const pendentes = p.itens.filter((i) => !marcados.has(i))
    if (pendentes.length === 0) return `*${p.nome}*\n✅ Tudo marcado`
    return `*${p.nome}* (${p.itens.length - pendentes.length}/${p.itens.length})\n` +
      pendentes.map((i) => `◻️ ${i}`).join('\n')
  })
  return '📝 *Checklist de hoje*\n\n' + blocos.join('\n\n')
}

// --- Blocos do resumo semanal ---

export function blocoCarteiraSemana(v: VariacaoPeriodo | null): string | null {
  if (!v || v.patrimonio <= 0) return null
  return (
    `*Carteira:* ${formatBRL(v.patrimonio)}\n` +
    `Na semana: ${brlComSinal(v.ganho)} (${pct(v.pct)})`
  )
}

export interface PollDaSemana {
  checklistId: string
  nome: string
  completos: number
  total: number
}

/** "• Treino: 5/7 dias completos (82%)", um por checklist. */
export function blocoChecklistsSemana(polls: PollDaSemana[]): string | null {
  const porChecklist = new Map<string, { nome: string; dias: number; completos: number; somaPct: number }>()
  for (const p of polls) {
    const atual = porChecklist.get(p.checklistId) ?? { nome: p.nome, dias: 0, completos: 0, somaPct: 0 }
    atual.dias++
    if (p.total > 0 && p.completos >= p.total) atual.completos++
    atual.somaPct += p.total > 0 ? Math.min(p.completos / p.total, 1) : 0
    porChecklist.set(p.checklistId, atual)
  }
  if (porChecklist.size === 0) return null

  const linhas = [...porChecklist.values()]
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
    .map((c) => {
      const media = Math.round((c.somaPct / c.dias) * 100)
      return `• ${c.nome}: ${c.completos}/${c.dias} ${c.dias === 1 ? 'dia completo' : 'dias completos'} (${media}%)`
    })
  return '*Checklists:*\n' + linhas.join('\n')
}
