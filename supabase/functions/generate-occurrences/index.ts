import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

function nextMonthlyDate(dayOfMonth: number): string {
  const now = new Date()
  const next = new Date(now.getFullYear(), now.getMonth() + 1, 1)
  const maxDay = new Date(next.getFullYear(), next.getMonth() + 1, 0).getDate()
  next.setDate(Math.min(dayOfMonth, maxDay))
  return next.toISOString().split('T')[0]
}

function nextWeeklyDates(dayOfWeek: number, weeks = 4): string[] {
  const dates: string[] = []
  const now = new Date()
  const today = now.getDay()
  let diff = dayOfWeek - today
  if (diff <= 0) diff += 7
  const first = new Date(now)
  first.setDate(now.getDate() + diff)
  for (let i = 0; i < weeks; i++) {
    const d = new Date(first)
    d.setDate(first.getDate() + i * 7)
    dates.push(d.toISOString().split('T')[0])
  }
  return dates
}

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  const { data: bills, error } = await supabase
    .from('bills')
    .select('id, recurrence_type, recurrence_day_of_month, recurrence_day_of_week, due_date, amount, days_before_alert')
    .eq('is_active', true)

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 })
  }

  let created = 0

  for (const bill of bills ?? []) {
    const dueDates: string[] = []

    if (bill.recurrence_type === 'monthly' && bill.recurrence_day_of_month) {
      dueDates.push(nextMonthlyDate(bill.recurrence_day_of_month))
    } else if (bill.recurrence_type === 'weekly' && bill.recurrence_day_of_week !== null) {
      dueDates.push(...nextWeeklyDates(bill.recurrence_day_of_week))
    } else if (bill.recurrence_type === 'once' && bill.due_date) {
      dueDates.push(bill.due_date)
    }

    for (const dueDate of dueDates) {
      // Idempotency: skip if occurrence already exists for this bill+date
      const { count } = await supabase
        .from('bill_occurrences')
        .select('id', { count: 'exact', head: true })
        .eq('bill_id', bill.id)
        .eq('due_date', dueDate)

      if ((count ?? 0) > 0) continue

      const { data: occ, error: occErr } = await supabase
        .from('bill_occurrences')
        .insert({ bill_id: bill.id, due_date: dueDate, amount: bill.amount, status: 'pending' })
        .select()
        .single()

      if (occErr || !occ) continue

      // Schedule 2 notifications
      const beforeDate = new Date(dueDate + 'T12:00:00')
      beforeDate.setDate(beforeDate.getDate() - (bill.days_before_alert ?? 3))
      const beforeStr = beforeDate.toISOString().split('T')[0]

      await supabase.from('notifications').insert([
        { bill_occurrence_id: occ.id, type: 'before_due',   scheduled_for: beforeStr, status: 'scheduled' },
        { bill_occurrence_id: occ.id, type: 'on_due_date',  scheduled_for: dueDate,   status: 'scheduled' },
      ])

      created++
    }
  }

  return new Response(JSON.stringify({ ok: true, created }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
