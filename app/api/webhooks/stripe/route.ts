import { NextRequest, NextResponse } from 'next/server'
import { stripe } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-admin'
import Stripe from 'stripe'
import { SubscriptionUpdateData } from '@/lib/types'

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
    // Retornar 200 mesmo com erro para evitar retries desnecessários
    // mas logar para investigação
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
  const adminClient = createAdminClient()
  
  // Obter subscription ID e customer ID
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

  // Buscar subscription para obter detalhes
  const subscription: Stripe.Subscription = await stripe.subscriptions.retrieve(subscriptionId)

  // Atualizar daily_user
  const updateData: SubscriptionUpdateData = {
    payment_provider: 'stripe',
    payment_customer_id: customerId,
    payment_subscription_id: subscriptionId,
    payment_status: subscription.status === 'active' || subscription.status === 'trialing' ? 'paid' : 'pending',
  }

  // Se subscription está ativa ou em trial
  if (subscription.status === 'active' || subscription.status === 'trialing') {
    updateData.subscription_status = subscription.status === 'trialing' ? 'trial' : 'active'
    
    // Calcular data de término
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const periodEnd = (subscription as any).current_period_end as number | undefined
    if (periodEnd) {
      const endsAt = new Date(periodEnd * 1000)
      updateData.subscription_ends_at = endsAt.toISOString()
      updateData.next_billing_date = endsAt.toISOString()
    }
  }

  await adminClient
    .from('daily_user')
    .update(updateData)
    .eq('id', parseInt(dailyUserId))

  console.log('[STRIPE WEBHOOK] Checkout concluído para usuário:', dailyUserId)
}

/**
 * Handler para atualização de assinatura
 */
async function handleSubscriptionUpdated(
  subscription: Stripe.Subscription
) {
  const adminClient = createAdminClient()
  
  const customerId = subscription.customer as string
  const subscriptionId = subscription.id
  
  // Buscar usuário pelo customer_id ou subscription_id
  const { data: dailyUser } = await adminClient
    .from('daily_user')
    .select('*')
    .or(`payment_customer_id.eq.${customerId},payment_subscription_id.eq.${subscriptionId}`)
    .single()

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para subscription:', subscriptionId)
    return
  }

  const updateData: SubscriptionUpdateData = {
    payment_status: subscription.status === 'active' ? 'paid' : 'pending',
  }

  // Mapear status do Stripe para o sistema
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

  // Atualizar datas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const periodEnd = (subscription as any).current_period_end as number | undefined
  if (periodEnd) {
    const endsAt = new Date(periodEnd * 1000)
    updateData.subscription_ends_at = endsAt.toISOString()
    updateData.next_billing_date = endsAt.toISOString()
  }

  await adminClient
    .from('daily_user')
    .update(updateData)
    .eq('id', dailyUser.id)

  console.log('[STRIPE WEBHOOK] Assinatura atualizada:', subscriptionId)
}

/**
 * Handler para assinatura cancelada
 */
async function handleSubscriptionDeleted(
  subscription: Stripe.Subscription
) {
  const adminClient = createAdminClient()
  
  const subscriptionId = subscription.id
  
  const { data: dailyUser } = await adminClient
    .from('daily_user')
    .select('*')
    .eq('payment_subscription_id', subscriptionId)
    .single()

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para subscription cancelada:', subscriptionId)
    return
  }

  await adminClient
    .from('daily_user')
    .update({
      subscription_status: 'cancelled',
      payment_status: 'cancelled',
    })
    .eq('id', dailyUser.id)

  console.log('[STRIPE WEBHOOK] Assinatura cancelada:', subscriptionId)
}

/**
 * Handler para invoice pago
 */
async function handleInvoicePaid(invoice: Stripe.Invoice) {
  const adminClient = createAdminClient()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string | null | undefined
  if (!subscriptionId) return

  const { data: dailyUser } = await adminClient
    .from('daily_user')
    .select('*')
    .eq('payment_subscription_id', subscriptionId)
    .single()

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para invoice pago:', invoice.id)
    return
  }

  // Atualizar próxima data de cobrança
  if (invoice.period_end) {
    const nextBilling = new Date(invoice.period_end * 1000)
    await adminClient
      .from('daily_user')
      .update({
        payment_status: 'paid',
        subscription_status: 'active',
        subscription_ends_at: nextBilling.toISOString(),
        next_billing_date: nextBilling.toISOString(),
      })
      .eq('id', dailyUser.id)
  }

  console.log('[STRIPE WEBHOOK] Invoice pago:', invoice.id)
}

/**
 * Handler para falha no pagamento
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const adminClient = createAdminClient()
  
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const subscriptionId = (invoice as any).subscription as string | null | undefined
  if (!subscriptionId) return

  const { data: dailyUser } = await adminClient
    .from('daily_user')
    .select('*')
    .eq('payment_subscription_id', subscriptionId)
    .single()

  if (!dailyUser) {
    console.warn('[STRIPE WEBHOOK] Usuário não encontrado para invoice com falha:', invoice.id)
    return
  }

  await adminClient
    .from('daily_user')
    .update({
      payment_status: 'failed',
    })
    .eq('id', dailyUser.id)

  console.log('[STRIPE WEBHOOK] Falha no pagamento:', invoice.id)
}