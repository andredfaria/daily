import { supabase } from '../lib/supabase'
import type { BillOccurrence, DashboardStats, OccurrenceStatus } from '../types'

export interface ListOccurrencesParams {
  status?: OccurrenceStatus
  bill_id?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

export const occurrencesApi = {
  list: async (params?: ListOccurrencesParams): Promise<BillOccurrence[]> => {
    let query = supabase
      .from('bill_occurrences')
      .select('*, bill:bills(*)')
      .order('due_date', { ascending: true })

    if (params?.status)  query = query.eq('status', params.status)
    if (params?.bill_id) query = query.eq('bill_id', params.bill_id)
    if (params?.from)    query = query.gte('due_date', params.from)
    if (params?.to)      query = query.lte('due_date', params.to)
    if (params?.limit)   query = query.limit(params.limit)
    if (params?.offset)  query = query.range(params.offset, (params.offset) + (params.limit ?? 50) - 1)

    const { data, error } = await query
    if (error) throw error
    return data as BillOccurrence[]
  },

  upcoming: async (days = 30): Promise<BillOccurrence[]> => {
    const today = new Date().toISOString().split('T')[0]
    const until = new Date(Date.now() + days * 86400000).toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('bill_occurrences')
      .select('*, bill:bills(*)')
      .gte('due_date', today)
      .lte('due_date', until)
      .in('status', ['pending', 'overdue'])
      .order('due_date', { ascending: true })
    if (error) throw error
    return data as BillOccurrence[]
  },

  get: async (id: string): Promise<BillOccurrence> => {
    const { data, error } = await supabase
      .from('bill_occurrences')
      .select('*, bill:bills(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as BillOccurrence
  },

  markAsPaid: async (
    id: string,
    payload?: { confirmation_source?: string },
  ): Promise<BillOccurrence> => {
    const { data, error } = await supabase
      .from('bill_occurrences')
      .update({
        status: 'paid',
        paid_at: new Date().toISOString(),
        confirmation_source: payload?.confirmation_source ?? 'web',
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error

    // Cancel pending notifications for this occurrence
    await supabase
      .from('notifications')
      .update({ status: 'skipped' })
      .eq('bill_occurrence_id', id)
      .eq('status', 'scheduled')

    return data as BillOccurrence
  },

  updateStatus: async (id: string, status: OccurrenceStatus): Promise<BillOccurrence> => {
    const { data, error } = await supabase
      .from('bill_occurrences')
      .update({ status })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as BillOccurrence
  },

  getDashboardStats: async (): Promise<DashboardStats> => {
    const today = new Date().toISOString().split('T')[0]
    const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    const monthStart = today.slice(0, 7) + '-01'
    const monthEnd = today.slice(0, 7) + '-31'

    const [activeBills, dueWeek, monthOccurrences] = await Promise.all([
      supabase.from('bills').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase
        .from('bill_occurrences')
        .select('id', { count: 'exact', head: true })
        .gte('due_date', today)
        .lte('due_date', weekEnd)
        .in('status', ['pending', 'overdue']),
      supabase
        .from('bill_occurrences')
        .select('amount, status')
        .gte('due_date', monthStart)
        .lte('due_date', monthEnd),
    ])

    const occs = monthOccurrences.data ?? []
    const paid    = occs.filter(o => o.status === 'paid')
    const pending = occs.filter(o => o.status === 'pending')
    const overdue = occs.filter(o => o.status === 'overdue')
    const sum = (arr: { amount: number }[]) => arr.reduce((acc, o) => acc + Number(o.amount), 0)

    return {
      active_bills:           activeBills.count ?? 0,
      due_this_week:          dueWeek.count ?? 0,
      paid_this_month:        paid.length,
      waha_connected:         false, // managed by Edge Function
      monthly_paid_amount:    sum(paid),
      monthly_pending_amount: sum(pending),
      monthly_overdue_amount: sum(overdue),
      paid_count:             paid.length,
      pending_count:          pending.length,
      overdue_count:          overdue.length,
    }
  },
}
