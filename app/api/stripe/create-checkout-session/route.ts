import { NextRequest, NextResponse } from 'next/server'
import { stripe, validateStripeEnvironment } from '@/lib/stripe'
import { createClient } from '@/lib/supabase-server'
import { createAdminClient } from '@/lib/supabase-admin'

/**
 * API Route para criar uma sessão de checkout do Stripe
 * 
 * Este endpoint:
 * 1. Valida o usuário autenticado
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

    // Obter usuário autenticado
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user || !user.email) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar daily_user
    const adminClient = createAdminClient()
    const { data: dailyUser, error: userError } = await adminClient
      .from('daily_user')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (userError || !dailyUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    // Obter Price ID das variáveis de ambiente ou usar padrão
    // O Price ID deve ser configurado no .env.local após criar o produto no Stripe Dashboard
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
        email: user.email,
        metadata: {
          daily_user_id: dailyUser.id.toString(),
          auth_user_id: user.id,
        },
      })
      customerId = customer.id

      // Salvar customer_id no banco
      await adminClient
        .from('daily_user')
        .update({ payment_customer_id: customerId })
        .eq('id', dailyUser.id)
    }

    // Criar Checkout Session
    const origin = request.headers.get('origin') || 
                   process.env.NEXT_PUBLIC_APP_URL || 
                   'http://localhost:3000'

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription', // Modo de assinatura recorrente
      payment_method_types: ['card'], // Aceitar cartão de crédito
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      subscription_data: {
        metadata: {
          daily_user_id: dailyUser.id.toString(),
          auth_user_id: user.id,
        },
        // Período de trial (opcional)
        trial_period_days: 7, // 7 dias de teste gratuito
      },
      success_url: `${origin}/subscription?session_id={CHECKOUT_SESSION_ID}&success=true`,
      cancel_url: `${origin}/subscription?canceled=true`,
      // Metadata adicional na sessão
      metadata: {
        daily_user_id: dailyUser.id.toString(),
      },
    })

    return NextResponse.json({ 
      sessionId: session.id,
      url: session.url 
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