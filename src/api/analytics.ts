import client from './client'
import type { ByCategoryResponse, ProjectionResponse } from '../types'

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
}
