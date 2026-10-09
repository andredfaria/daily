import pool from '../db'
import { getTodaySaoPaulo } from './notificationMaterializer'

// Pagamento de conta: marca o vencimento (bill_occurrences) como pago.
// Paga = paid_at preenchido; não há coluna de status. A checagem de dono
// (bills.user_id) é de quem chama — rota ou comando do WhatsApp.

export type OrigemPagamento = 'app' | 'whatsapp'

export interface OcorrenciaPaga {
  id: string
  bill_id: string
  due_date: string // YYYY-MM-DD
  amount: number
  amount_is_actual: number
  paid_at: string | null // instante em ISO 8601 (UTC)
  paid_source: OrigemPagamento | null
}

export type CodigoErroPagamento = 'valor_obrigatorio' | 'nao_encontrada'

export class ErroPagamento extends Error {
  constructor(public readonly codigo: CodigoErroPagamento) {
    super(codigo === 'valor_obrigatorio'
      ? 'Informe o valor pago da conta variável'
      : 'Ocorrência não encontrada')
    this.name = 'ErroPagamento'
  }
}

// Dia 1º do mês de uma data YYYY-MM-DD.
export function primeiroDiaDoMes(hoje: string): string {
  return `${hoje.slice(0, 7)}-01`
}

const COLUNAS = `o.id, o.bill_id, DATE_FORMAT(o.due_date, '%Y-%m-%d') AS due_date, o.amount,
                 o.amount_is_actual, o.paid_at, o.paid_source`

// O mysql2 devolve DECIMAL como string e DATETIME como Date.
function paraOcorrencia(r: any): OcorrenciaPaga {
  return {
    id: r.id,
    bill_id: r.bill_id,
    due_date: r.due_date,
    amount: Number(r.amount),
    amount_is_actual: Number(r.amount_is_actual) ? 1 : 0,
    paid_at: r.paid_at instanceof Date ? r.paid_at.toISOString() : (r.paid_at ?? null),
    paid_source: r.paid_source ?? null,
  }
}

async function buscar(occurrenceId: string): Promise<OcorrenciaPaga> {
  const [rows]: any = await pool.query(
    `SELECT ${COLUNAS} FROM bill_occurrences o WHERE o.id = ?`,
    [occurrenceId]
  )
  if (!rows.length) throw new ErroPagamento('nao_encontrada')
  return paraOcorrencia(rows[0])
}

// Lança ErroPagamento('valor_obrigatorio') se a conta é variável e amount é null/undefined.
// Conta fixa ignora amount. Variável grava amount + amount_is_actual = 1.
// Marca notifications 'scheduled' da ocorrência como 'skipped'.
// Marcar de novo uma ocorrência já paga mantém a data e a origem do primeiro
// pagamento; na variável, o valor informado substitui o anterior.
export async function marcarPaga(
  occurrenceId: string, origem: OrigemPagamento, amount?: number | null,
): Promise<OcorrenciaPaga> {
  const [rows]: any = await pool.query(
    `SELECT o.id, b.is_fixed FROM bill_occurrences o JOIN bills b ON b.id = o.bill_id WHERE o.id = ?`,
    [occurrenceId]
  )
  if (!rows.length) throw new ErroPagamento('nao_encontrada')
  const variavel = !rows[0].is_fixed
  if (variavel && (amount === null || amount === undefined)) {
    throw new ErroPagamento('valor_obrigatorio')
  }

  const agora = new Date()
  // paid_source vem antes de paid_at: o MySQL avalia o SET da esquerda para a
  // direita, e o IF precisa enxergar o paid_at ainda sem a gravação nova.
  const sets = [
    'paid_source = IF(paid_at IS NULL, ?, paid_source)',
    'paid_at = COALESCE(paid_at, ?)',
    'updated_at = ?',
  ]
  const valores: any[] = [origem, agora, agora]
  if (variavel) {
    sets.push('amount = ?', 'amount_is_actual = 1')
    valores.push(amount)
  }
  valores.push(occurrenceId)
  await pool.query(`UPDATE bill_occurrences SET ${sets.join(', ')} WHERE id = ?`, valores)

  // Lembrete que ainda não saiu deixa de sair. O dispatcher também confere
  // paid_at, para o que já estava sendo processado.
  await pool.query(
    `UPDATE notifications SET status = 'skipped', updated_at = ?
      WHERE bill_occurrence_id = ? AND status = 'scheduled'`,
    [agora, occurrenceId]
  )

  return buscar(occurrenceId)
}

// Zera paid_at/paid_source. Valor real informado continua.
// Lembrete já pulado não volta; os dos dias seguintes voltam a ser criados.
export async function desmarcarPaga(occurrenceId: string): Promise<OcorrenciaPaga> {
  await pool.query(
    'UPDATE bill_occurrences SET paid_at = NULL, paid_source = NULL, updated_at = ? WHERE id = ?',
    [new Date(), occurrenceId]
  )
  return buscar(occurrenceId)
}

// Vencimento atual entre as ocorrências da conta a partir do dia 1º do mês
// (em ordem de data): a primeira do mês ainda em aberto, mesmo atrasada; com o
// mês todo pago, a última do mês, para o card continuar mostrando "paga"; sem
// vencimento no mês, o próximo. Na semanal, pagar a semana 1 libera a semana 2.
export function escolherOcorrenciaAtual<T extends { due_date: string; paid_at: string | null }>(
  ocorrencias: T[], hoje: string,
): T | null {
  const mes = hoje.slice(0, 7)
  const doMes = ocorrencias.filter((o) => o.due_date.slice(0, 7) === mes)
  return doMes.find((o) => !o.paid_at) ?? doMes[doMes.length - 1] ?? ocorrencias[0] ?? null
}

// Vencimento atual de várias contas (regra de escolherOcorrenciaAtual).
// Conta sem ocorrência fica de fora.
export async function ocorrenciasAtuaisDasContas(billIds: string[]): Promise<Record<string, OcorrenciaPaga>> {
  const porConta: Record<string, OcorrenciaPaga> = {}
  if (!billIds.length) return porConta
  const hoje = getTodaySaoPaulo()
  const [rows]: any = await pool.query(
    `SELECT ${COLUNAS} FROM bill_occurrences o
      WHERE o.bill_id IN (?) AND o.due_date >= ?
      ORDER BY o.due_date ASC`,
    [billIds, primeiroDiaDoMes(hoje)]
  )
  const listas: Record<string, OcorrenciaPaga[]> = {}
  for (const r of rows) (listas[r.bill_id] ??= []).push(paraOcorrencia(r))
  for (const [billId, lista] of Object.entries(listas)) {
    const atual = escolherOcorrenciaAtual(lista, hoje)
    if (atual) porConta[billId] = atual
  }
  return porConta
}

// Vencimento atual da conta (regra de escolherOcorrenciaAtual) ou null.
export async function ocorrenciaAtualDaConta(billId: string): Promise<OcorrenciaPaga | null> {
  return (await ocorrenciasAtuaisDasContas([billId]))[billId] ?? null
}
