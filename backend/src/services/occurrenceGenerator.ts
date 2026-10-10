import { v4 as uuidv4 } from 'uuid'
import pool from '../db'

function lastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

function toDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function generateMonthlyDates(dayOfMonth: number, count = 12): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const year = now.getFullYear() + Math.floor((now.getMonth() + i) / 12)
    const month = (now.getMonth() + i) % 12
    const cappedDay = Math.min(dayOfMonth, lastDayOfMonth(year, month))
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(cappedDay).padStart(2, '0')}`)
  }
  return dates
}

function generateWeeklyDates(dayOfWeek: number, count = 12): string[] {
  const dates: string[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const daysUntilTarget = (dayOfWeek - now.getDay() + 7) % 7 || 7
  const first = new Date(now)
  first.setDate(now.getDate() + daysUntilTarget)
  for (let i = 0; i < count; i++) {
    const d = new Date(first)
    d.setDate(first.getDate() + i * 7)
    dates.push(toDateString(d))
  }
  return dates
}

function generateBiweeklyDates(dayOfWeek: number, count = 12): string[] {
  const dates: string[] = []
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const daysUntilTarget = (dayOfWeek - now.getDay() + 7) % 7 || 14
  const first = new Date(now)
  first.setDate(now.getDate() + daysUntilTarget)
  for (let i = 0; i < count; i++) {
    const d = new Date(first)
    d.setDate(first.getDate() + i * 14)
    dates.push(toDateString(d))
  }
  return dates
}

function generateNMonthlyDates(dayOfMonth: number, monthStep: number, count = 6): string[] {
  const dates: string[] = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const totalMonths = now.getMonth() + i * monthStep
    const year = now.getFullYear() + Math.floor(totalMonths / 12)
    const month = totalMonths % 12
    const cappedDay = Math.min(dayOfMonth, lastDayOfMonth(year, month))
    dates.push(`${year}-${String(month + 1).padStart(2, '0')}-${String(cappedDay).padStart(2, '0')}`)
  }
  return dates
}

type TipoRecorrencia = 'monthly' | 'weekly' | 'once' | 'biweekly' | 'quarterly' | 'semiannual' | 'annual'

interface ContaParaGerar {
  recurrence_type: TipoRecorrencia
  recurrence_day_of_month?: number | null
  recurrence_day_of_week?: number | null
  due_date?: string | null
  amount: number
}

// Datas que o gerador produz hoje, partindo do mês/semana corrente.
function datasDoGerador(bill: ContaParaGerar): string[] {
  if (bill.recurrence_type === 'once') {
    return bill.due_date ? [String(bill.due_date).slice(0, 10)] : []
  }
  if (bill.recurrence_type === 'weekly' || bill.recurrence_type === 'biweekly') {
    if (bill.recurrence_day_of_week == null) return []
    return bill.recurrence_type === 'weekly'
      ? generateWeeklyDates(bill.recurrence_day_of_week)
      : generateBiweeklyDates(bill.recurrence_day_of_week)
  }
  if (!bill.recurrence_day_of_month) return []
  if (bill.recurrence_type === 'monthly') return generateMonthlyDates(bill.recurrence_day_of_month)
  if (bill.recurrence_type === 'quarterly') return generateNMonthlyDates(bill.recurrence_day_of_month, 3)
  if (bill.recurrence_type === 'semiannual') return generateNMonthlyDates(bill.recurrence_day_of_month, 6)
  return generateNMonthlyDates(bill.recurrence_day_of_month, 12, 3)
}

// Insere as datas que a conta ainda não tem. Devolve quantas entraram.
async function inserirDatasQueFaltam(billId: string, targetDates: string[], amount: number): Promise<number> {
  if (!targetDates.length) return 0

  const [existing]: any = await pool.query(
    'SELECT due_date FROM bill_occurrences WHERE bill_id = ?',
    [billId]
  )
  const existingDates = new Set<string>(
    existing.map((r: any) => {
      const d = r.due_date instanceof Date ? toDateString(r.due_date) : String(r.due_date).slice(0, 10)
      return d
    })
  )

  const toInsert = targetDates.filter(d => !existingDates.has(d))
  if (!toInsert.length) return 0

  const values = toInsert.map(d => [uuidv4(), billId, d, amount, new Date(), new Date()])
  await pool.query(
    `INSERT INTO bill_occurrences (id, bill_id, due_date, amount, created_at, updated_at) VALUES ?`,
    [values]
  )
  console.log(`[occurrences] geradas ${toInsert.length} ocorrência(s) para bill ${billId}`)
  return toInsert.length
}

export async function generateOccurrencesForBill(billId: string, bill: ContaParaGerar): Promise<void> {
  await inserirDatasQueFaltam(billId, datasDoGerador(bill), bill.amount)
}

// Quinzenal, trimestral, semestral e anual contam a partir de hoje no
// gerador: rodar em outro dia desalinharia o ciclo (a trimestral de outubro
// ganharia novembro). Para completar, essas seguem da última ocorrência.
const PASSO_EM_MESES: Partial<Record<TipoRecorrencia, number>> = { quarterly: 3, semiannual: 6, annual: 12 }

function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Próximas datas depois de `ultima`, mantendo o ciclo dela, até `ate` (inclusive). */
export function continuarDatas(
  tipo: TipoRecorrencia, ultima: string, diaDoMes: number | null | undefined, ate: string,
): string[] {
  const datas: string[] = []
  if (tipo === 'biweekly') {
    for (let d = somarDias(ultima, 14); d <= ate; d = somarDias(d, 14)) datas.push(d)
    return datas
  }
  const passo = PASSO_EM_MESES[tipo]
  if (!passo || !diaDoMes) return datas
  let ano = Number(ultima.slice(0, 4))
  let mes = Number(ultima.slice(5, 7)) - 1
  for (;;) {
    mes += passo
    ano += Math.floor(mes / 12)
    mes %= 12
    const dia = Math.min(diaDoMes, lastDayOfMonth(ano, mes))
    const data = `${ano}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
    if (data > ate) return datas
    datas.push(data)
  }
}

/**
 * Completa os vencimentos de todas as contas ativas. O gerador só rodava na
 * criação e na troca de data: conta criada antes dele ficou sem nenhum
 * vencimento, e as outras param de ter depois de 12 meses. Só insere data que
 * falta, então repetir não duplica nem mexe em pagamento e valor real.
 */
export async function completarOcorrencias(): Promise<number> {
  const [contas]: any = await pool.query(
    `SELECT b.id, b.recurrence_type, b.recurrence_day_of_month, b.recurrence_day_of_week,
            DATE_FORMAT(b.due_date, '%Y-%m-%d') AS due_date, b.amount,
            DATE_FORMAT(MAX(o.due_date), '%Y-%m-%d') AS ultima
       FROM bills b
       LEFT JOIN bill_occurrences o ON o.bill_id = b.id
      WHERE b.is_active = 1
      GROUP BY b.id`
  )

  let total = 0
  for (const conta of contas) {
    try {
      const doGerador = datasDoGerador(conta)
      const segueCiclo = conta.ultima && (conta.recurrence_type === 'biweekly' || PASSO_EM_MESES[conta.recurrence_type as TipoRecorrencia])
      const datas = segueCiclo
        ? continuarDatas(conta.recurrence_type, conta.ultima, conta.recurrence_day_of_month, doGerador[doGerador.length - 1] ?? conta.ultima)
        : doGerador
      total += await inserirDatasQueFaltam(conta.id, datas, Number(conta.amount))
    } catch (err: any) {
      console.error(`[occurrences] erro ao completar bill ${conta.id}:`, err.message)
    }
  }
  return total
}

export async function regenerateOccurrencesForBill(
  billId: string,
  bill: {
    recurrence_type: 'monthly' | 'weekly' | 'once' | 'biweekly' | 'quarterly' | 'semiannual' | 'annual'
    recurrence_day_of_month?: number | null
    recurrence_day_of_week?: number | null
    due_date?: string | null
    amount: number
  }
): Promise<void> {
  const today = toDateString(new Date())
  await pool.query(
    `DELETE FROM bill_occurrences WHERE bill_id = ? AND due_date >= ?`,
    [billId, today]
  )
  await generateOccurrencesForBill(billId, bill)
}

/**
 * Leva o valor da conta para as ocorrências futuras sem regerá-las — regerar
 * apagaria os lembretes já agendados. Em conta variável, ocorrência com valor
 * real informado fica como está; em conta fixa não existe valor real, então
 * tudo volta para o valor da conta (é o que acontece ao trocar de variável para fixa).
 */
export async function aplicarValorDaConta(billId: string, amount: number, isFixed: boolean): Promise<void> {
  const today = toDateString(new Date())
  await pool.query(
    `UPDATE bill_occurrences SET amount = ?, amount_is_actual = 0
      WHERE bill_id = ? AND due_date >= ? AND (amount_is_actual = 0 OR ?)`,
    [amount, billId, today, isFixed ? 1 : 0]
  )
}
