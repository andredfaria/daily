import Stripe from 'stripe'

let stripeClient: Stripe | null = null

/**
 * Retorna uma instância singleton do cliente Stripe.
 *
 * IMPORTANTE: a inicialização é lazy para evitar erros em tempo de build
 * quando as variáveis de ambiente ainda não estão disponíveis.
 */
export function getStripeClient(): Stripe {
  const secretKey = process.env.STRIPE_SECRET_KEY

  if (!secretKey) {
    throw new Error('STRIPE_SECRET_KEY não configurada')
  }

  if (!stripeClient) {
    stripeClient = new Stripe(secretKey, {
      apiVersion: '2025-12-15.clover',
      typescript: true,
    })
  }

  return stripeClient
}

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
