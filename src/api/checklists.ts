import client from './client'
import type { Checklist, ChecklistDashboardData, ChecklistPollNotif, ChecklistRecurrenceType, ChecklistStatsEntry } from '../types'

export interface CreateChecklistPayload {
  name?: string
  send_time?: number
  timezone?: string
  recurrence_type?: ChecklistRecurrenceType
  recurrence_days?: number[]
  items: { text: string }[]
}

export interface UpdateChecklistPayload {
  name?: string
  send_time?: number
  timezone?: string
  recurrence_type?: ChecklistRecurrenceType
  recurrence_days?: number[] | null
  items?: { text: string }[]
}

export const checklistsApi = {
  get: async (): Promise<Checklist[]> => {
    const res = await client.get<Checklist[]>('/checklists')
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

  clearHistory: async (id: string): Promise<{ deleted: number }> => {
    const res = await client.delete<{ deleted: number }>(`/checklists/${id}/history`)
    return res.data
  },

  dashboard: async (checklistId?: string): Promise<ChecklistDashboardData> => {
    const res = await client.get<ChecklistDashboardData>('/checklists/dashboard', {
      params: checklistId ? { checklistId } : undefined,
    })
    return res.data
  },

  stats: async (): Promise<ChecklistStatsEntry[]> => {
    const res = await client.get<ChecklistStatsEntry[]>('/checklists/stats')
    return res.data
  },

  sendNow: async (force = false, checklistId?: string): Promise<void> => {
    await client.post('/checklists/send-now', { force, checklistId })
  },

  polls: async (params: {
    upcoming?: boolean
    history?: boolean
  }): Promise<ChecklistPollNotif[]> => {
    const res = await client.get<ChecklistPollNotif[]>('/checklists/polls', { params })
    return res.data
  },
}
