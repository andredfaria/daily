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

  exportCsv: async (params?: ListOccurrencesParams): Promise<void> => {
    const query = new URLSearchParams()
    if (params?.status) query.set('status', params.status)
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    if (params?.bill_id) query.set('bill_id', params.bill_id)

    const token = localStorage.getItem('billsync_token')
    const res = await fetch(`/api/occurrences/export?${query}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    if (!res.ok) throw new Error('Falha ao exportar')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `billsync-historico-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  },
}
