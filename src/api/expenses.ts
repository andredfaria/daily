import client from './client'
import type { ExpensesResponse } from '../types'
import type { CategoriaGasto } from '../utils/categoriasGasto'

/** category vazio na criação: o backend deduz pela descrição. */
export interface DadosGasto {
  amount: number
  description: string
  category?: CategoriaGasto
  spent_on: string
}

export const expensesApi = {
  list: async (month: string): Promise<ExpensesResponse> => {
    const res = await client.get<ExpensesResponse>('/expenses', { params: { month } })
    return res.data
  },

  create: async (data: DadosGasto): Promise<void> => {
    await client.post('/expenses', data)
  },

  update: async (id: string, data: DadosGasto): Promise<void> => {
    await client.patch(`/expenses/${id}`, data)
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/expenses/${id}`)
  },
}
