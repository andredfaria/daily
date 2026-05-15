import client from './client'
import type { Checklist, ChecklistDashboardData } from '../types'

export interface CreateChecklistPayload {
  name?: string
  send_time?: number
  timezone?: string
  items: { text: string }[]
}

export interface UpdateChecklistPayload {
  name?: string
  send_time?: number
  timezone?: string
  items?: { text: string }[]
}

export const checklistsApi = {
  get: async (): Promise<Checklist | null> => {
    const res = await client.get<Checklist | null>('/checklists')
    return res.data
  },

  create: async (payload: CreateChecklistPayload): Promise<Checklist> => {
    const res = await client.post<Checklist>('/checklists', payload)
    return res.data
  },

  update: async (id: string, payload: UpdateChecklistPayload): Promise<Checklist> => {
    const res = await client.put<Checklist>(`/checklists/${id}`, payload)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/checklists/${id}`)
  },

  dashboard: async (): Promise<ChecklistDashboardData> => {
    const res = await client.get<ChecklistDashboardData>('/checklists/dashboard')
    return res.data
  },

  sendNow: async (force = false): Promise<void> => {
    await client.post('/checklists/send-now', { force })
  },
}
