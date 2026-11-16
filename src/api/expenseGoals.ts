import client from './client'
import type { MetaPeriodo } from '../utils/metasPeriodo'

export interface DadosMetaPeriodo {
  name: string
  start_date: string
  end_date: string
  amount: number
}

/** Meta semanal: valor null desliga; dias 0=domingo. */
export interface DadosMetaSemanal {
  weekend_expense_goal: number | null
  weekend_goal_start_dow: number
  weekend_goal_end_dow: number
}

export const expenseGoalsApi = {
  list: async (): Promise<MetaPeriodo[]> => {
    const res = await client.get<MetaPeriodo[]>('/expense-goals')
    return res.data
  },

  create: async (data: DadosMetaPeriodo): Promise<void> => {
    await client.post('/expense-goals', data)
  },

  update: async (id: string, data: DadosMetaPeriodo): Promise<void> => {
    await client.patch(`/expense-goals/${id}`, data)
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/expense-goals/${id}`)
  },

  /** A meta semanal fica no usuário, não em expense_goals. */
  salvarSemanal: async (data: DadosMetaSemanal): Promise<void> => {
    await client.patch('/users/me', data)
  },
}
