import pool from '../db'
import { formatDateSaoPaulo } from './assetMath'

// Tipos de mensagem que passam pela trava. Cada um define o que é "a mesma
// mensagem" através da chave: o resumo mensal é um por mês fechado, o alerta de
// ativos é um por dia, a enquete é uma por checklist por dia.
export type ClaimKind =
  | 'weekly_summary'
  | 'monthly_summary'
  | 'budget_alert'
  | 'asset_alert'
  | 'checklist_poll'
  | 'checklist_inactivity'

export function claimKeyDia(agora = new Date()): string {
  return formatDateSaoPaulo(agora)
}

export function claimKeyMes(agora = new Date()): string {
  return formatDateSaoPaulo(agora).slice(0, 7)
}

// Mês fechado — o que o relatório mensal reporta quando roda no dia 1º.
export function claimKeyMesAnterior(agora = new Date()): string {
  const [ano, mes] = claimKeyMes(agora).split('-').map(Number)
  const anterior = mes === 1 ? { ano: ano - 1, mes: 12 } : { ano, mes: mes - 1 }
  return `${anterior.ano}-${String(anterior.mes).padStart(2, '0')}`
}

// Reserva o direito de enviar. Devolve true para exatamente um chamador, mesmo
// com várias instâncias do backend disputando o mesmo tick — a unique key do
// banco é quem decide. É o mesmo princípio do claim atômico que o dispatcher de
// contas já usa em notifications.status.
export async function claimMessage(
  userId: string,
  kind: ClaimKind,
  refKey: string,
): Promise<boolean> {
  try {
    await pool.query(
      'INSERT INTO message_claims (user_id, kind, ref_key) VALUES (?, ?, ?)',
      [userId, kind, refKey],
    )
    return true
  } catch (err: any) {
    // Perder a corrida é o caminho esperado nas outras instâncias, não um erro.
    if (err.code === 'ER_DUP_ENTRY') return false
    throw err
  }
}

// Devolve o claim quando o envio falha, para que uma execução posterior possa
// tentar de novo. Sem isso, uma falha de rede no WAHA silenciaria a mensagem
// daquele dia inteiro.
export async function releaseMessageClaim(
  userId: string,
  kind: ClaimKind,
  refKey: string,
): Promise<void> {
  try {
    await pool.query(
      'DELETE FROM message_claims WHERE user_id = ? AND kind = ? AND ref_key = ?',
      [userId, kind, refKey],
    )
  } catch (err: any) {
    console.error('[messageClaim] erro ao liberar claim:', err.message)
  }
}

// Erros em que a requisição nem chegou a sair da máquina.
const CODIGOS_SEM_ENTREGA = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ERR_INVALID_URL'])

/**
 * Dá para afirmar que a mensagem NÃO foi entregue?
 *
 * Liberar a trava depois de um erro ambíguo é o que transforma a garantia em
 * "pelo menos uma vez": o cliente WAHA tem timeout de 10s, e um timeout do
 * axios não cancela o envio do lado do WhatsApp — a mensagem sai, o claim volta
 * e a próxima execução manda de novo. Então só liberamos quando a não-entrega
 * é certa; na dúvida, a trava fica de pé e o dia passa sem mensagem.
 * Perder uma mensagem incomoda, receber duas quebra a confiança no app.
 */
export function isDeliveryRuledOut(err: any): boolean {
  // O número não existe no WhatsApp: nem chegamos a pedir o envio.
  if (err?.name === 'WhatsAppNumberNotFoundError') return true

  const status = err?.response?.status
  if (typeof status === 'number') {
    // O WAHA respondeu recusando. 4xx é recusa definitiva — menos 408 e 429,
    // em que a mensagem pode ter sido processada antes de o limite bater.
    // 5xx fica de fora: um 502/504 de proxy costuma vir com a requisição já
    // entregue ao WAHA.
    return status >= 400 && status < 500 && status !== 408 && status !== 429
  }

  // Sem resposta: só é seguro quando a conexão sequer foi estabelecida.
  // Timeout (ECONNABORTED/ETIMEDOUT) e conexão derrubada no meio (ECONNRESET)
  // são justamente os casos em que a mensagem pode ter saído.
  return CODIGOS_SEM_ENTREGA.has(err?.code)
}

function descreveFalha(err: any): string {
  const status = err?.response?.status
  if (typeof status === 'number') return `HTTP ${status}`
  return err?.code ?? err?.message ?? 'erro desconhecido'
}

/**
 * Libera a trava apenas quando a não-entrega é certa. Devolve true se liberou,
 * ou seja, se uma execução posterior pode tentar de novo sem risco de duplicar.
 */
export async function releaseMessageClaimIfUndelivered(
  userId: string,
  kind: ClaimKind,
  refKey: string,
  err: any,
): Promise<boolean> {
  if (!isDeliveryRuledOut(err)) {
    console.warn(
      `[messageClaim] ${kind} (${refKey}) ficou em estado indefinido (${descreveFalha(err)}) — ` +
        'trava mantida para não duplicar; não haverá reenvio automático',
    )
    return false
  }
  await releaseMessageClaim(userId, kind, refKey)
  return true
}
