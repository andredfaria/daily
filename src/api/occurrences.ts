import client, { TOKEN_KEY } from './client'
import type { BillOccurrence, OcorrenciaAtual } from '../types'

export interface ListOccurrencesParams {
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

  /** Valor real do mês de uma conta variável; null volta para a estimativa. */
  setAmount: async (id: string, amount: number | null): Promise<OcorrenciaAtual> => {
    const res = await client.patch<OcorrenciaAtual>(`/occurrences/${id}`, { amount })
    return res.data
  },

  /** Marca o vencimento como pago. Na conta variável, amount (valor pago) é obrigatório. */
  pagar: async (id: string, amount?: number | null): Promise<OcorrenciaAtual> => {
    const res = await client.post<OcorrenciaAtual>(`/occurrences/${id}/pagar`, amount === undefined ? {} : { amount })
    return res.data
  },

  /** Volta o vencimento para em aberto. O valor real informado continua. */
  desfazerPagamento: async (id: string): Promise<OcorrenciaAtual> => {
    const res = await client.delete<OcorrenciaAtual>(`/occurrences/${id}/pagar`)
    return res.data
  },

  getDashboardStats: async () => {
    const res = await client.get('/occurrences/stats')
    return res.data
  },

  exportCsv: async (params?: ListOccurrencesParams): Promise<void> => {
    const query = new URLSearchParams()
    if (params?.from) query.set('from', params.from)
    if (params?.to) query.set('to', params.to)
    if (params?.bill_id) query.set('bill_id', params.bill_id)

    const token = localStorage.getItem(TOKEN_KEY)
    const res = await fetch(`/api/occurrences/export?${query}`, {
      headers: { Authorization: `Bearer ${token ?? ''}` },
    })
    if (!res.ok) throw new Error('Falha ao exportar')
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `rotina-historico-${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 100)
  },
}
