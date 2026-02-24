import { NextRequest, NextResponse } from 'next/server'
import { stripe, validateStripeEnvironment } from '@/lib/stripe'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById, updateDailyUser } from '@/lib/db/daily_user'

/**
 * API Route para criar uma sessão de checkout do Stripe
 * 
 * Este endpoint:
 * 1. Valida o usuário autenticado via JWT
 * 2. Cria ou recupera o Customer no Stripe
 * 3. Cria uma sessão de checkout para assinatura recorrente
 * 4. Retorna a URL para redirecionamento
 */
export async function POST(request: NextRequest) {
  try {
    // Validar ambiente Stripe
    const envCheck = validateStripeEnvironment()
    if (envCheck.error) {
      return NextResponse.json(
        { error: envCheck.error },
        { status: 500 }
      )
    }

    // Obter usuário autenticado via JWT
    const session = await getSessionFromCookies()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar daily_user
    const dailyUser = await getDailyUserById(session.userId)

    if (!dailyUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Obter Price ID das variáveis de ambiente
    const priceId = process.env.STRIPE_PRICE_ID || 'price_XXXXXXXXXXXX'

    if (priceId === 'price_XXXXXXXXXXXX') {
      return NextResponse.json(
        { error: 'STRIPE_PRICE_ID não configurado. Configure a variável de ambiente com o Price ID do Stripe.' },
        { status: 500 }
      )
    }

    // Criar ou buscar Customer no Stripe
    let customerId = dailyUser.payment_customer_id

    if (!customerId) {
      // Criar novo customer no Stripe
      const customer = await stripe.customers.create({
        email: dailyUser.email || undefined,
        metadata: {
          daily_user_id: dailyUser.id.toString(),
        },
      })
      customerId = customer.id

      // Salvar customer_id no banco
      await updateDailyUser(dailyUser.id, { payment_customer_id: customerId })
    }

    // Criar Checkout Session
    const origin = request.headers.get('origin') ||
      process.env.NEXT_PUBLIC_APP_URL ||
      'http://localhost:3000'

    const checkoutSession = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          daily_user_id: dailyUser.id.toString(),
        },
        trial_period_days: 7,
      },
      success_url: `${origin}/subscription?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/subscription?canceled=true`,
      metadata: {
        daily_user_id: dailyUser.id.toString(),
      },
    })

    return NextResponse.json({
      sessionId: checkoutSession.id,
      url: checkoutSession.url
    })
  } catch (error: unknown) {
    console.error('[STRIPE CHECKOUT] Erro:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro ao criar checkout'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}