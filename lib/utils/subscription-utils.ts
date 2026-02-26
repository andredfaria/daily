import { DailyUser } from '@/lib/types'

/**
 * Utilitários de assinatura que NÃO dependem de bibliotecas de servidor (MySQL, fs, etc.)
 * Podem ser usados tanto no Client quanto no Server.
 */

/**
 * Verifica se a assinatura do usuário está ativa
 * Admins sempre têm acesso ativo
 * 
 * @param user - Usuário DailyUser
 * @returns true se a assinatura está ativa, false caso contrário
 */
export function isSubscriptionActive(user: DailyUser): boolean {
  // Admins sempre têm acesso
  if (user.is_admin) return true
  
  // Verificar assinatura ativa
  if (user.subscription_status === 'active') {
    if (!user.subscription_ends_at) return true
    return new Date(user.subscription_ends_at) > new Date()
  }
  
  // Verificar trial ativo
  if (user.subscription_status === 'trial') {
    if (!user.trial_ends_at) return false
    return new Date(user.trial_ends_at) > new Date()
  }
  
  // Status 'cancelled' ou 'expired' = sem acesso
  return false
}

/**
 * Calcula os dias restantes do trial ou assinatura
 * 
 * @param user - Usuário DailyUser
 * @returns Número de dias restantes, 0 se não houver período ativo
 */
export function getDaysRemaining(user: DailyUser): number {
  if (user.subscription_status === 'trial' && user.trial_ends_at) {
    const now = new Date()
    const end = new Date(user.trial_ends_at)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }
  
  if (user.subscription_status === 'active' && user.subscription_ends_at) {
    const now = new Date()
    const end = new Date(user.subscription_ends_at)
    const diff = end.getTime() - now.getTime()
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
  }
  
  return 0
}

/**
 * Verifica se o trial está próximo de expirar (últimos 2 dias)
 * 
 * @param user - Usuário DailyUser
 * @returns true se faltam 2 dias ou menos para expirar o trial
 */
export function isTrialExpiringSoon(user: DailyUser): boolean {
  if (user.is_admin) return false
  if (user.subscription_status !== 'trial') return false
  if (!user.trial_ends_at) return false

  const daysRemaining = getDaysRemaining(user)
  return daysRemaining <= 2 && daysRemaining > 0
}
