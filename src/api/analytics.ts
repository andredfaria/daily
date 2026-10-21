import client from './client'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, TopOccurrencesResponse, FechamentoContasResponse, MesHistoricoContas } from '../types'

export const analyticsApi = {
  byCategory: async (from?: string, to?: string): Promise<ByCategoryResponse> => {
    const res = await client.get<ByCategoryResponse>('/analytics/by-category', {
      params: { from, to },
    })
    return res.data
  },

  projection: async (months = 6): Promise<ProjectionResponse> => {
    const res = await client.get<ProjectionResponse>('/analytics/projection', {
      params: { months },
    })
    return res.data
  },

  history: async (months = 6): Promise<ProjectionResponse> => {
    const res = await client.get<ProjectionResponse>('/analytics/history', {
      params: { months },
    })
    return res.data
  },

  budget: async (): Promise<BudgetResponse> => {
    const res = await client.get<BudgetResponse>('/analytics/budget')
    return res.data
  },

  topOccurrences: async (from: string, to: string, limit = 5): Promise<TopOccurrencesResponse> => {
    const res = await client.get<TopOccurrencesResponse>('/analytics/top-occurrences', {
      params: { from, to, limit },
    })
    return res.data
  },

  /** Contas pagas e em aberto do mês (YYYY-MM), por categoria. Sem mes, o corrente. */
  fechamentoContas: async (mes?: string): Promise<FechamentoContasResponse> => {
    const res = await client.get<FechamentoContasResponse>('/analytics/bills-month', {
      params: { mes },
    })
    return res.data
  },

  /** Pago x em aberto dos últimos N meses, do mais antigo ao corrente. */
  historicoContas: async (meses = 12): Promise<MesHistoricoContas[]> => {
    const res = await client.get<{ meses: MesHistoricoContas[] }>('/analytics/bills-history', {
      params: { meses },
    })
    return res.data.meses
  },
}
