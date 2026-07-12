import client from './client'
import type { ByCategoryResponse, ProjectionResponse, BudgetResponse, TopOccurrencesResponse } from '../types'

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
}
