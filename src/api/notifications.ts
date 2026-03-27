import { supabase } from '../lib/supabase'
import type { Notification } from '../types'

export const notificationsApi = {
  list: async (params?: { status?: string; limit?: number }): Promise<Notification[]> => {
    let query = supabase
      .from('notifications')
      .select('*')
      .order('scheduled_for', { ascending: false })

    if (params?.status) query = query.eq('status', params.status)
    if (params?.limit)  query = query.limit(params.limit)

    const { data, error } = await query
    if (error) throw error
    return data as Notification[]
  },

  dueToday: async (): Promise<Notification[]> => {
    const today = new Date().toISOString().split('T')[0]
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('scheduled_for', today)
      .eq('status', 'scheduled')
    if (error) throw error
    return data as Notification[]
  },

  markSent: async (id: string, waha_message_id?: string): Promise<Notification> => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ status: 'sent', sent_at: new Date().toISOString(), waha_message_id })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Notification
  },

  markFailed: async (id: string, error_detail?: string): Promise<Notification> => {
    const { data, error } = await supabase
      .from('notifications')
      .update({ status: 'failed', error_detail })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Notification
  },

  // WAHA status is now managed via Supabase Edge Function
  getWahaStatus: async (): Promise<{ connected: boolean; session?: string }> => {
    const { data, error } = await supabase.functions.invoke('waha-status')
    if (error) return { connected: false }
    return data
  },
}
