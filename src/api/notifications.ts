import client from './client'
import type { Notification, NotificationEnriched } from '../types'

export const notificationsApi = {
  list: async (params?: { status?: string; limit?: number }): Promise<Notification[]> => {
    const res = await client.get<Notification[]>('/notifications', { params })
    return res.data
  },

  dueToday: async (): Promise<Notification[]> => {
    const res = await client.get<Notification[]>('/notifications/due-today')
    return res.data
  },

  markSent: async (id: string, waha_message_id?: string): Promise<Notification> => {
    const res = await client.patch<Notification>(`/notifications/${id}/sent`, {
      waha_message_id,
    })
    return res.data
  },

  markFailed: async (id: string, error_detail?: string): Promise<Notification> => {
    const res = await client.patch<Notification>(`/notifications/${id}/failed`, {
      error_detail,
    })
    return res.data
  },

  getWahaStatus: async (): Promise<{ connected: boolean; session?: string }> => {
    const res = await client.get('/waha/status')
    return res.data
  },

  reconnectWaha: async (): Promise<{ qr_code?: string; status: string }> => {
    const res = await client.post('/waha/reconnect')
    return res.data
  },

  disconnectWaha: async (): Promise<void> => {
    await client.post('/waha/disconnect')
  },

  testMessage: async (): Promise<{ success: boolean; to?: string; message_id?: string; error?: string }> => {
    const res = await client.post('/waha/test-message')
    return res.data
  },

  dispatch: async (): Promise<{ sent: number; failed: number; skipped: number }> => {
    const res = await client.post<{ sent: number; failed: number; skipped: number }>('/notifications/dispatch')
    return res.data
  },

  listEnriched: async (params?: {
    upcoming?: boolean
    history?: boolean
    limit?: number
  }): Promise<NotificationEnriched[]> => {
    const res = await client.get<NotificationEnriched[]>('/notifications', { params })
    return res.data
  },

  resend: async (id: string): Promise<{ result: string; notification: NotificationEnriched }> => {
    const res = await client.post<{ result: string; notification: NotificationEnriched }>(
      `/notifications/${id}/resend`
    )
    return res.data
  },

  getWhatsAppProfile(): Promise<{ name: string | null; about: string | null; profilePicUrl: string | null }> {
    return client.get('/waha/profile').then((r) => r.data)
  },

  cancel: async (id: string): Promise<void> => {
    await client.delete(`/notifications/${id}`)
  },

  materialize: async (days = 30): Promise<{ created: number; days: number }> => {
    const res = await client.post<{ created: number; days: number }>(`/notifications/materialize?days=${days}`)
    return res.data
  },
}
