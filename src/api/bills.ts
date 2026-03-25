import client from './client'
import type { Bill, PaymentMethod } from '../types'

export interface CreateBillPayload {
  name: string
  description?: string
  amount: number
  recurrence_type: string
  recurrence_day_of_month?: number
  recurrence_day_of_week?: number
  due_date?: string
  days_before_alert: number
  is_active?: boolean
}

export interface UpdateBillPayload extends Partial<CreateBillPayload> {}

export interface CreatePaymentMethodPayload {
  type: 'pix' | 'boleto'
  pix_key_type?: string
  pix_key?: string
  pix_beneficiary?: string
  boleto_code?: string
  is_primary?: boolean
}

export const billsApi = {
  list: async (): Promise<Bill[]> => {
    const res = await client.get<Bill[]>('/bills')
    return res.data
  },

  get: async (id: string): Promise<Bill> => {
    const res = await client.get<Bill>(`/bills/${id}`)
    return res.data
  },

  create: async (payload: CreateBillPayload): Promise<Bill> => {
    const res = await client.post<Bill>('/bills', payload)
    return res.data
  },

  update: async (id: string, payload: UpdateBillPayload): Promise<Bill> => {
    const res = await client.patch<Bill>(`/bills/${id}`, payload)
    return res.data
  },

  delete: async (id: string): Promise<void> => {
    await client.delete(`/bills/${id}`)
  },

  toggle: async (id: string, is_active: boolean): Promise<Bill> => {
    const res = await client.patch<Bill>(`/bills/${id}`, { is_active })
    return res.data
  },

  // Payment Methods
  getPaymentMethods: async (billId: string): Promise<PaymentMethod[]> => {
    const res = await client.get<PaymentMethod[]>(`/bills/${billId}/payment-methods`)
    return res.data
  },

  addPaymentMethod: async (
    billId: string,
    payload: CreatePaymentMethodPayload,
  ): Promise<PaymentMethod> => {
    const res = await client.post<PaymentMethod>(`/bills/${billId}/payment-methods`, payload)
    return res.data
  },

  updatePaymentMethod: async (
    billId: string,
    methodId: string,
    payload: Partial<CreatePaymentMethodPayload>,
  ): Promise<PaymentMethod> => {
    const res = await client.patch<PaymentMethod>(
      `/bills/${billId}/payment-methods/${methodId}`,
      payload,
    )
    return res.data
  },

  deletePaymentMethod: async (billId: string, methodId: string): Promise<void> => {
    await client.delete(`/bills/${billId}/payment-methods/${methodId}`)
  },
}
