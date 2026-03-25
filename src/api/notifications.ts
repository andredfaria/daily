import client from './client'
import type { Notification } from '../types'

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
}
