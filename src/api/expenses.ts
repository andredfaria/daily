import client from './client'
import type { ExpensesResponse } from '../types'

export const expensesApi = {
  list: async (month: string): Promise<ExpensesResponse> => {
    const res = await client.get<ExpensesResponse>('/expenses', { params: { month } })
    return res.data
  },

  create: async (data: { amount: number; description: string; spent_on: string }): Promise<void> => {
    await client.post('/expenses', data)
  },

  update: async (id: string, data: { amount: number; description: string; spent_on: string }): Promise<void> => {
    await client.patch(`/expenses/${id}`, data)
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/expenses/${id}`)
  },
}
