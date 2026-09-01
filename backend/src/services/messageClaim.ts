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
