// Interface para itens do checklist
export interface ChecklistItem {
  id: string
  text: string
}

// Interface para opções do usuário (FORMATO ANTIGO - Mantido para compatibilidade)
// NOTA: O campo 'option' agora armazena apenas array JSON: ["item1", "item2"]
// Não usar mais o formato de objeto
export interface UserOptions {
  checklist?: string[]
  sendTime?: string
}

// Interface para usuário do sistema Daily
export interface DailyUser {
  id: number
  created_at: string
  phone: string | null
  title: string | null
  name: string | null
  time_to_send: number | null
  option: string | null  // JSON stringified array de strings: ["⏰ Item 1", "💪 Item 2"] - Enquete WhatsApp
  auth_user_id: string | null  // UUID do Supabase Auth - UNIQUE, nullable
  is_admin: boolean  // Flag de administrador
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'expired'
  trial_ends_at?: string
  subscription_ends_at?: string
  subscription_plan?: 'basic' | 'premium' | 'enterprise'
  payment_provider?: 'hotmart' | 'stripe' | 'asaas' | 'mercadopago'
  payment_customer_id?: string
  payment_subscription_id?: string
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
  next_billing_date?: string
}

// Alias para compatibilidade
export type User = DailyUser

// Interface para dados de atividade diária
export interface DailyData {
  id: number
  id_user: number
  created_at: string
  activity_date: string
  check_status: boolean
  option?: string | null  // Campo existe no schema do banco
}

// Alias para compatibilidade
export type Activity = DailyData

// Interface para dados do formulário de usuário
export interface UserFormData {
  name: string | null
  title: string | null
  phone: string | null
  sendTime: string | null
  checklist: string[]
}

// Interface para metadata do usuário (usado em ensureDailyUserLink)
export interface UserMetadata {
  name?: string
  phone?: string | null
}

// Interface para dados de atualização de assinatura
export interface SubscriptionUpdateData {
  subscription_status?: 'trial' | 'active' | 'cancelled' | 'expired'
  subscription_ends_at?: string
  subscription_plan?: 'basic' | 'premium' | 'enterprise'
  payment_provider?: 'hotmart' | 'stripe' | 'asaas' | 'mercadopago'
  payment_customer_id?: string
  payment_subscription_id?: string
  payment_status?: 'pending' | 'paid' | 'failed' | 'refunded' | 'cancelled'
  next_billing_date?: string
}
