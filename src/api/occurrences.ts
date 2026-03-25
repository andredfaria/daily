import client from './client'
import type { BillOccurrence, OccurrenceStatus } from '../types'

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
    const res = await client.get<BillOccurrence[]>('/occurrences', { params })
    return res.data
  },

  upcoming: async (days = 30): Promise<BillOccurrence[]> => {
    const res = await client.get<BillOccurrence[]>('/occurrences/upcoming', {
      params: { days },
    })
    return res.data
  },

  get: async (id: string): Promise<BillOccurrence> => {
    const res = await client.get<BillOccurrence>(`/occurrences/${id}`)
    return res.data
  },

  markAsPaid: async (
    id: string,
    payload?: { paid_via?: string; confirmation_source?: string },
  ): Promise<BillOccurrence> => {
    const res = await client.patch<BillOccurrence>(`/occurrences/${id}/pay`, payload ?? {})
    return res.data
  },

  updateStatus: async (id: string, status: OccurrenceStatus): Promise<BillOccurrence> => {
    const res = await client.patch<BillOccurrence>(`/occurrences/${id}`, { status })
    return res.data
  },

  getDashboardStats: async () => {
    const res = await client.get('/occurrences/stats')
    return res.data
  },
}
