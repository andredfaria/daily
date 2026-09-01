export type RecurrenceType = 'monthly' | 'weekly' | 'once' | 'biweekly' | 'quarterly' | 'semiannual' | 'annual'
export type BillCategory = 'moradia' | 'assinaturas' | 'serviços' | 'saúde' | 'educação' | 'transporte' | 'alimentação' | 'outro'
export type NotificationStatus = 'scheduled' | 'sent' | 'failed' | 'skipped'
export type PaymentMethodType = 'pix' | 'boleto'
export type PixKeyType = 'cpf' | 'email' | 'phone' | 'random'

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
  category?: BillCategory
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
  bill_name?: string
  due_date: string
  amount: number
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
  pm_type?: 'pix' | 'boleto'
  pix_key_type?: PixKeyType
  pix_key?: string
  pix_beneficiary?: string
  boleto_code?: string
}

export interface ChecklistPollNotif {
  id: string
  checklist_id: string
  checklist_name: string
  poll_date: string
  status: 'pending' | 'sent' | 'completed'
  completed_count: number
  total_count: number
  completion_pct: number
  selected_options: string[]
  items: string[]
  sent_at?: string
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
  summary_enabled: boolean
  summary_day_of_week: number
  monthly_summary_enabled: boolean
  monthly_budget_limit: number | null
  onboarding_completed: boolean
  created_at: string
  updated_at: string
}

export interface ChecklistItem {
  id: string
  checklist_id: string
  text: string
  sort_order: number
}

export type ChecklistRecurrenceType = 'daily' | 'weekdays' | 'custom'

export interface Checklist {
  id: string
  user_id: string
  name: string
  send_time: number
  recurrence_type: ChecklistRecurrenceType
  recurrence_days: number[] | null
  timezone: string
  is_active: boolean
  items: ChecklistItem[]
  created_at: string
  updated_at: string
}

export interface DailyPoll {
  id: string
  poll_date: string
  waha_poll_id?: string
  selected_options: string[]
  completed_count: number
  total_count: number
  completion_pct: number
  status: 'pending' | 'sent' | 'completed'
  created_at: string
}

export interface ChecklistStatsEntry {
  checklist_id: string
  week_count: number
  month_count: number
  total_count: number
}

export interface ChecklistItemStat {
  text: string
  marked_count: number
  total_polls: number
  pct: number
  streak_current: number
  streak_best: number
}

export interface ChecklistDashboardData {
  checklist: Checklist | null
  today: DailyPoll | null
  history: Array<{
    poll_date: string
    completed_count: number
    total_count: number
    completion_pct: number
    status: string
  }>
  itemStats: ChecklistItemStat[]
}

export interface DashboardStats {
  active_bills: number
  due_this_week: number
  waha_connected: boolean
}

export interface CategoryBreakdown {
  category: string
  total: number
  count: number
  pct: number
}

export interface ByCategoryResponse {
  from: string
  to: string
  total: number
  categorias: CategoryBreakdown[]
}

export interface ProjectionMonth {
  ano: number
  mes: number
  label: string
  total: number
}

export interface ProjectionResponse {
  meses: ProjectionMonth[]
}

export interface BudgetResponse {
  total: number
  orcamento: number | null
  qtdContas: number
  porCategoria: Array<{ category: string; total: number }>
}

export interface OcorrenciaTop {
  id: string
  bill_id: string
  bill_name: string
  category: string
  amount: number
  due_date: string
}

export interface TopOccurrencesResponse {
  ocorrencias: OcorrenciaTop[]
}

export type AssetKind = 'stock' | 'fii' | 'crypto'

export interface Asset {
  id: string
  user_id: string
  ticker: string
  kind: AssetKind
  quantity: number
  avg_price: number
  target_price: number | null
  stop_price: number | null
  target_triggered_at: string | null
  stop_triggered_at: string | null
  last_price: number | null
  last_quote_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface AssetWithQuote extends Asset {
  short_name: string
  current_price: number | null
  quote_stale: boolean
  invested_value: number
  current_value: number | null
  profit_loss: number | null
  profit_loss_pct: number | null
}

export interface AssetHistoryPoint {
  date: string
  current_value: number
  invested_value: number
}

export interface AssetHistoryResponse {
  pontos: AssetHistoryPoint[]
}
