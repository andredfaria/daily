import client from './client'
import type { ExpensesResponse } from '../types'
import type { CategoriaGasto } from '../utils/categoriasGasto'

/** category vazio na criação: o backend deduz pela descrição. */
export interface DadosGasto {
  amount: number
  description: string
  category?: string
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

  categorias: async (): Promise<CategoriaGasto[]> => {
    const res = await client.get<CategoriaGasto[]>('/expenses/categories')
    return res.data
  },

  criarCategoria: async (data: { name: string; icon: string }): Promise<CategoriaGasto[]> => {
    const res = await client.post<CategoriaGasto[]>('/expenses/categories', data)
    return res.data
  },

  atualizarCategoria: async (key: string, data: { name?: string; icon?: string; hidden?: boolean }): Promise<CategoriaGasto[]> => {
    const res = await client.patch<CategoriaGasto[]>(`/expenses/categories/${encodeURIComponent(key)}`, data)
    return res.data
  },

  apagarCategoria: async (key: string): Promise<{ gastosMovidos: number; contasMovidas: number; categorias: CategoriaGasto[] }> => {
    const res = await client.delete(`/expenses/categories/${encodeURIComponent(key)}`)
    return res.data
  },
}
