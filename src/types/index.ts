export type RecurrenceType = 'monthly' | 'weekly' | 'once'
export type OccurrenceStatus = 'pending' | 'paid' | 'overdue' | 'cancelled'
export type NotificationStatus = 'scheduled' | 'sent' | 'failed' | 'skipped'
export type PaymentMethodType = 'pix' | 'boleto'
export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random'
export type ConfirmationSource = 'whatsapp' | 'web' | 'manual'

export interface PaymentMethod {
  id: string
  bill_id: string
  type: PaymentMethodType
  pix_key_type?: PixKeyType
  pix_key?: string
  pix_beneficiary?: string
  boleto_code?: string
  is_primary: boolean
  created_at: string
}

export interface Bill {
  id: string
  user_id: string
  name: string
  description?: string
  amount: number
  recurrence_type: RecurrenceType
  recurrence_day_of_month?: number
  recurrence_day_of_week?: number
  due_date?: string
  days_before_alert: number
  is_active: boolean
  created_at: string
  updated_at: string
  payment_methods?: PaymentMethod[]
}

export interface BillOccurrence {
  id: string
  bill_id: string
  bill?: Bill
  due_date: string
  amount: number
  status: OccurrenceStatus
  paid_at?: string
  paid_via?: string
  confirmation_source?: ConfirmationSource
  whatsapp_msg?: string
  created_at: string
  updated_at: string
}

export interface Notification {
  id: string
  bill_occurrence_id: string
  type: 'before_due' | 'on_due_date'
  scheduled_for: string
  sent_at?: string
  status: NotificationStatus
  waha_message_id?: string
  message_body?: string
  error_detail?: string
  created_at: string
}

export interface NotificationEnriched extends Notification {
  bill_name: string
  due_date: string
  amount: number
}

export interface User {
  id: string
  name?: string
  whatsapp_number: string
  timezone: string
  is_active: boolean
  whatsapp_alerts_enabled: boolean
  weekly_summary_enabled: boolean
  default_days_before_alert: number
  notification_time: number
  created_at: string
  updated_at: string
}

export interface DashboardStats {
  active_bills: number
  due_this_week: number
  paid_this_month: number
  waha_connected: boolean
  monthly_paid_amount: number
  monthly_pending_amount: number
  monthly_overdue_amount: number
  paid_count: number
  pending_count: number
  overdue_count: number
}
