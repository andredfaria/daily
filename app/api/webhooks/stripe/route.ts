import { NextRequest, NextResponse } from 'next/server'
import { getStripeClient } from '@/lib/stripe'
import Stripe from 'stripe'
import { SubscriptionUpdateData } from '@/lib/types'
import {
  getDailyUserByPaymentSubscriptionId,
  getDailyUserByPaymentCustomerOrSubscription,
  updateDailyUser
} from '@/lib/db/daily_user'

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

/**
 * Webhook endpoint para receber eventos do Stripe
 * 
 * Eventos processados:
 * - checkout.session.completed: Checkout concluído
 * - customer.subscription.created: Nova assinatura criada
 * - customer.subscription.updated: Assinatura atualizada
 * - customer.subscription.deleted: Assinatura cancelada
 * - invoice.paid: Fatura paga (renovação)
 * - invoice.payment_failed: Falha no pagamento
 */
export async function POST(request: NextRequest) {
  const stripe = getStripeClient()

  // Obter assinatura do header
  const signature = request.headers.get('stripe-signature')

  if (!signature) {
    return NextResponse.json(
      { error: 'Missing signature' },
      { status: 400 }
    )
  }

  if (!webhookSecret) {
    console.error('[STRIPE WEBHOOK] STRIPE_WEBHOOK_SECRET não configurada')
    return NextResponse.json(
      { error: 'Webhook secret não configurado' },
      { status: 500 }
    )
  }

  // Obter corpo raw da requisição (importante para verificação)
  const rawBody = await request.text()

  let event: Stripe.Event

  try {
    // Verificar assinatura do webhook
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      webhookSecret
    )
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido na verificação'
    console.error('[STRIPE WEBHOOK] Erro na verificação:', errorMessage)
    return NextResponse.json(
      { error: `Webhook Error: ${errorMessage}` },
      { status: 400 }
    )
  }

  // Processar eventos
  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription)
        break

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription)
        break

      case 'invoice.paid':
        await handleInvoicePaid(event.data.object as Stripe.Invoice)
        break

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice)
        break

      default:
        console.log(`[STRIPE WEBHOOK] Evento não tratado: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[STRIPE WEBHOOK] Erro ao processar:', error)
    return NextResponse.json(
      { error: 'Erro ao processar webhook' },
      { status: 200 }
    )
  }
}

/**
 * Handler para checkout concluído
 */
async function handleCheckoutSessionCompleted(
  session: Stripe.Checkout.Session
) {
  const stripe = getStripeClient()

  const subscriptionId = session.subscription as string
  const customerId = session.customer as string
  const dailyUserId = session.metadata?.daily_user_id

  if (!dailyUserId) {
    console.error('[STRIPE WEBHOOK] daily_user_id não encontrado no metadata')
    return
  }

  if (!subscriptionId) {
    console.error('[STRIPE WEBHOOK] subscription_id não encontrado na sessão')
    return
  }

  const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(subscriptionId)

  const updateData: SubscriptionUpdateData = {
    payment_provider: 'stripe',
    payment_customer_id: customerId,
    payment_subscription_id: subscriptionId,
    payment_status: subscription.status === 'active' || subscription.status === 'trialing' ? 'paid' : 'pending',
  }

  if (subscription.status === 'active' || subscription.status === 'trialing') {
    updateData.subscription_status = subscription.status === 'trialing' ? 'trial' : 'active'

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodEnd = (subscription as any).current_period_end as number | undefined
    if (periodEnd) {
      const endsAt = new Date(periodEnd * 1000)
      updateData.subscription_ends_at = endsAt.toISOString()
      updateData.next_billing_date = endsAt.toISOString()
    }
  }

  await updateDailyUser(parseInt(dailyUserId), updateData as Record<string, unknown>)

  console.log('[STRIPE WEBHOOK] Checkout concluído para usuário:', dailyUserId)
}

/**
 * Handler para atualização de assinatura
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id

  const dailyUser = await getDailyUserByPaymentCustomerOrSubscription(customerId, subscriptionId)

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para subscription:', subscriptionId)
    return
  }

  const updateData: SubscriptionUpdateData = {
    payment_status: subscription.status === 'active' ? 'paid' : 'pending',
  }

  switch (subscription.status) {
    case 'active':
      updateData.subscription_status = 'active'
      break
    case 'trialing':
      updateData.subscription_status = 'trial'
      break
    case 'canceled':
    case 'incomplete_expired':
      updateData.subscription_status = 'cancelled'
      updateData.payment_status = 'cancelled'
      break
    case 'past_due':
    case 'unpaid':
      updateData.subscription_status = 'expired'
      updateData.payment_status = 'failed'
      break
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (subscription as any).current_period_end as number | undefined
  if (periodEnd) {
    const endsAt = new Date(periodEnd * 1000)
    updateData.subscription_ends_at = endsAt.toISOString()
    updateData.next_billing_date = endsAt.toISOString()
  }

  await updateDailyUser(dailyUser.id, updateData as Record<string, unknown>)

  console.log('[STRIPE WEBHOOK] Assinatura atualizada:', subscriptionId)
}

/**
 * Handler para assinatura cancelada
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const subscriptionId = subscription.id

  const dailyUser = await getDailyUserByPaymentSubscriptionId(subscriptionId)

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para subscription cancelada:', subscriptionId)
    return
  }

  await updateDailyUser(dailyUser.id, {
    subscription_status: 'cancelled',
    payment_status: 'cancelled',
  })

  console.log('[STRIPE WEBHOOK] Assinatura cancelada:', subscriptionId)
}

/**
 * Handler para invoice pago
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string | null | undefined
  if (!subscriptionId) return

  const dailyUser = await getDailyUserByPaymentSubscriptionId(subscriptionId)

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para invoice pago:', invoice.id)
    return
  }

  if (invoice.period_end) {
    const nextBilling = new Date(invoice.period_end * 1000)
    await updateDailyUser(dailyUser.id, {
      payment_status: 'paid',
      subscription_status: 'active',
      subscription_ends_at: nextBilling.toISOString(),
      next_billing_date: nextBilling.toISOString(),
    })
  }

  console.log('[STRIPE WEBHOOK] Invoice pago:', invoice.id)
}

/**
 * Handler para falha no pagamento
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string | null | undefined
  if (!subscriptionId) return

  const dailyUser = await getDailyUserByPaymentSubscriptionId(subscriptionId)

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para invoice com falha:', invoice.id)
    return
  }

  await updateDailyUser(dailyUser.id, {
    payment_status: 'failed',
  })

  console.log('[STRIPE WEBHOOK] Falha no pagamento:', invoice.id)
}
