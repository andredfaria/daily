import { supabase } from '../lib/supabase'
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
    const { data, error } = await supabase
      .from('bills')
      .select('*, payment_methods(*)')
      .order('created_at', { ascending: false })
    if (error) throw error
    return data as Bill[]
  },

  get: async (id: string): Promise<Bill> => {
    const { data, error } = await supabase
      .from('bills')
      .select('*, payment_methods(*)')
      .eq('id', id)
      .single()
    if (error) throw error
    return data as Bill
  },

  create: async (payload: CreateBillPayload): Promise<Bill> => {
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase
      .from('bills')
      .insert({ ...payload, user_id: user!.id })
      .select()
      .single()
    if (error) throw error
    return data as Bill
  },

  update: async (id: string, payload: UpdateBillPayload): Promise<Bill> => {
    const { data, error } = await supabase
      .from('bills')
      .update(payload)
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Bill
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from('bills').delete().eq('id', id)
    if (error) throw error
  },

  toggle: async (id: string, is_active: boolean): Promise<Bill> => {
    const { data, error } = await supabase
      .from('bills')
      .update({ is_active })
      .eq('id', id)
      .select()
      .single()
    if (error) throw error
    return data as Bill
  },

  // Payment Methods
  getPaymentMethods: async (billId: string): Promise<PaymentMethod[]> => {
    const { data, error } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('bill_id', billId)
      .order('is_primary', { ascending: false })
    if (error) throw error
    return data as PaymentMethod[]
  },

  addPaymentMethod: async (
    billId: string,
    payload: CreatePaymentMethodPayload,
  ): Promise<PaymentMethod> => {
    const { data, error } = await supabase
      .from('payment_methods')
      .insert({ ...payload, bill_id: billId })
      .select()
      .single()
    if (error) throw error
    return data as PaymentMethod
  },

  updatePaymentMethod: async (
    billId: string,
    methodId: string,
    payload: Partial<CreatePaymentMethodPayload>,
  ): Promise<PaymentMethod> => {
    const { data, error } = await supabase
      .from('payment_methods')
      .update(payload)
      .eq('id', methodId)
      .eq('bill_id', billId)
      .select()
      .single()
    if (error) throw error
    return data as PaymentMethod
  },

  deletePaymentMethod: async (billId: string, methodId: string): Promise<void> => {
    const { error } = await supabase
      .from('payment_methods')
      .delete()
      .eq('id', methodId)
      .eq('bill_id', billId)
    if (error) throw error
  },
}
