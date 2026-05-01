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

export async function generateOccurrencesForBill(
  billId: string,
  bill: {
    recurrence_type: 'monthly' | 'weekly' | 'once'
    recurrence_day_of_month?: number | null
    recurrence_day_of_week?: number | null
    due_date?: string | null
    amount: number
  }
): Promise<void> {
  let targetDates: string[] = []

  if (bill.recurrence_type === 'once') {
    if (!bill.due_date) return
    targetDates = [bill.due_date.slice(0, 10)]
  } else if (bill.recurrence_type === 'monthly') {
    if (!bill.recurrence_day_of_month) return
    targetDates = generateMonthlyDates(bill.recurrence_day_of_month)
  } else if (bill.recurrence_type === 'weekly') {
    if (bill.recurrence_day_of_week == null) return
    targetDates = generateWeeklyDates(bill.recurrence_day_of_week)
  }

  if (!targetDates.length) return

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
  if (!toInsert.length) return

  const values = toInsert.map(d => [uuidv4(), billId, d, bill.amount, 'pending', new Date(), new Date()])
  await pool.query(
    `INSERT INTO bill_occurrences (id, bill_id, due_date, amount, status, created_at, updated_at) VALUES ?`,
    [values]
  )
  console.log(`[occurrences] geradas ${toInsert.length} ocorrência(s) para bill ${billId}`)
}

export async function regenerateOccurrencesForBill(
  billId: string,
  bill: {
    recurrence_type: 'monthly' | 'weekly' | 'once'
    recurrence_day_of_month?: number | null
    recurrence_day_of_week?: number | null
    due_date?: string | null
    amount: number
  }
): Promise<void> {
  const today = toDateString(new Date())
  await pool.query(
    `DELETE FROM bill_occurrences WHERE bill_id = ? AND status = 'pending' AND due_date >= ?`,
    [billId, today]
  )
  await generateOccurrencesForBill(billId, bill)
}
