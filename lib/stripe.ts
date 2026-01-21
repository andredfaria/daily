import Stripe from 'stripe'

// Inicializar cliente Stripe
// A versão da API será a mais recente disponível no momento da instalação
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2025-12-15.clover', // Usar versão estável mais recente
  typescript: true,
})

// Obter Publishable Key
export const getStripePublishableKey = () => {
  return process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!
}

// Verificar se as chaves estão configuradas
export function validateStripeEnvironment(): { error?: string } {
  if (!process.env.STRIPE_SECRET_KEY) {
    return { error: 'STRIPE_SECRET_KEY não configurada' }
  }
  if (!process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
    return { error: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY não configurada' }
  }
  return {}
}