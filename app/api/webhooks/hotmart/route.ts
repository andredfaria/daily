import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-admin'
import { validateHotmartToken } from '@/lib/hotmart'
import { DailyUser, SubscriptionUpdateData } from '@/lib/types'

/**
 * Webhook endpoint para receber eventos da Hotmart
 * 
 * Eventos suportados:
 * - PURCHASE_APPROVED: Compra aprovada (incluindo assinatura)
 * - SUBSCRIPTION_CANCELLED: Assinatura cancelada
 * - PURCHASE_REFUNDED: Reembolso
 * - CHARGEBACK: Chargeback
 */
export async function POST(request: NextRequest) {
  try {
    const payload = await request.json()
    
    console.log('[HOTMART WEBHOOK] Evento recebido:', JSON.stringify(payload, null, 2))

    // Validar token de segurança
    const receivedToken = payload.hottok || payload.data?.hottok
    
    if (!validateHotmartToken(receivedToken)) {
      console.error('[HOTMART WEBHOOK] Token inválido:', receivedToken)
      return NextResponse.json(
        { error: 'Token inválido' },
        { status: 401 }
      )
    }

    // Determinar tipo de evento
    // Hotmart pode enviar eventos em diferentes formatos
    const event = payload.event || payload.data?.event || 
                  (payload.data?.subscription?.status && 'SUBSCRIPTION_UPDATE') ||
                  (payload.status === 'APPROVED' && 'PURCHASE_APPROVED') ||
                  'UNKNOWN'

    console.log('[HOTMART WEBHOOK] Tipo de evento:', event)

    const adminClient = createAdminClient()

    // Extrair dados do payload
    const buyerEmail = payload.data?.buyer?.email || payload.buyer_email || payload.email
    const subscriberCode = payload.data?.subscription?.subscriber_code || payload.subscriber_code
    const transactionValue = payload.data?.transaction?.value || payload.price || payload.transaction_value
    const productId = payload.data?.product?.id || payload.prod

    if (!buyerEmail) {
      console.error('[HOTMART WEBHOOK] Email do comprador não encontrado no payload')
      return NextResponse.json(
        { error: 'Email do comprador não encontrado' },
        { status: 400 }
      )
    }

    // Buscar usuário por email (precisamos buscar via auth.users primeiro)
    // Como não temos direto, vamos buscar por auth_user_id que está no daily_user
    // ou buscar pelo email do buyer no auth.users
    let dailyUser = null

    // Tentar buscar daily_user por email (se armazenamos email em algum lugar)
    // Alternativa: buscar todos os auth.users e encontrar por email
    try {
      // Listar usuários do auth para encontrar por email
      const { data: authUsers } = await adminClient.auth.admin.listUsers()
      const authUser = authUsers.users.find(u => u.email === buyerEmail)

      if (authUser) {
        // Buscar daily_user pelo auth_user_id
        const { data: userData } = await adminClient
          .from('daily_user')
          .select('*')
          .eq('auth_user_id', authUser.id)
          .single()

        dailyUser = userData
      }
    } catch (error) {
      console.error('[HOTMART WEBHOOK] Erro ao buscar usuário:', error)
    }

    if (!dailyUser) {
      console.warn('[HOTMART WEBHOOK] Usuário não encontrado para email:', buyerEmail)
      // Não retornar erro - pode ser uma compra nova que ainda não tem usuário no sistema
      // Ou um email diferente do cadastrado
      return NextResponse.json({
        message: 'Usuário não encontrado, mas webhook processado',
        note: 'Criar usuário se necessário ou verificar email'
      })
    }

    // Processar eventos
    switch (event) {
      case 'PURCHASE_APPROVED':
      case 'APPROVED':
        await handlePurchaseApproved(adminClient, dailyUser, {
          subscriberCode,
          transactionValue,
          productId,
        })
        break

      case 'SUBSCRIPTION_CANCELLED':
      case 'CANCELLED':
        await handleSubscriptionCancelled(adminClient, dailyUser, {
          subscriberCode,
        })
        break

      case 'PURCHASE_REFUNDED':
      case 'REFUNDED':
        await handlePurchaseRefunded(adminClient, dailyUser)
        break

      case 'CHARGEBACK':
        await handleChargeback(adminClient, dailyUser)
        break

      default:
        console.warn('[HOTMART WEBHOOK] Evento não tratado:', event)
    }

    // Retornar sucesso
    return NextResponse.json({
      success: true,
      message: 'Webhook processado com sucesso',
      event,
    })
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro ao processar webhook:', error)
    
    // Retornar erro mas com status 200 para não gerar retry
    // (Hotmart retenta até 5 vezes)
    return NextResponse.json(
      { 
        error: 'Erro ao processar webhook',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 200 } // Retornar 200 para evitar retries desnecessários
    )
  }
}

/**
 * Handler para compra aprovada / assinatura ativada
 */
async function handlePurchaseApproved(
  adminClient: ReturnType<typeof createAdminClient>,
  dailyUser: DailyUser,
  data: { subscriberCode?: string; transactionValue?: number; productId?: string }
) {
  try {
    // Calcular data de término da assinatura (30 dias a partir de agora para plano mensal)
    const subscriptionEndsAt = new Date()
    subscriptionEndsAt.setDate(subscriptionEndsAt.getDate() + 30)

    const updateData: SubscriptionUpdateData = {
      subscription_status: 'active',
      subscription_ends_at: subscriptionEndsAt.toISOString(),
      subscription_plan: 'basic',
      payment_provider: 'hotmart',
      payment_status: 'paid',
      next_billing_date: subscriptionEndsAt.toISOString(),
    }

    // Adicionar subscription_id se disponível
    if (data.subscriberCode) {
      updateData.payment_subscription_id = data.subscriberCode
    }

    // Atualizar daily_user
    const { error } = await adminClient
      .from('daily_user')
      .update(updateData)
      .eq('id', dailyUser.id)

    if (error) {
      console.error('[HOTMART WEBHOOK] Erro ao atualizar assinatura:', error)
      throw error
    }

    console.log('[HOTMART WEBHOOK] Assinatura ativada para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handlePurchaseApproved:', error)
    throw error
  }
}

/**
 * Handler para assinatura cancelada
 */
async function handleSubscriptionCancelled(
  adminClient: ReturnType<typeof createAdminClient>,
  dailyUser: DailyUser,
  _data: { subscriberCode?: string }
) {
  try {
    const updateData: SubscriptionUpdateData = {
      subscription_status: 'cancelled',
      payment_status: 'cancelled',
    }

    const { error } = await adminClient
      .from('daily_user')
      .update(updateData)
      .eq('id', dailyUser.id)

    if (error) {
      console.error('[HOTMART WEBHOOK] Erro ao cancelar assinatura:', error)
      throw error
    }

    console.log('[HOTMART WEBHOOK] Assinatura cancelada para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handleSubscriptionCancelled:', error)
    throw error
  }
}

/**
 * Handler para reembolso
 */
async function handlePurchaseRefunded(
  adminClient: ReturnType<typeof createAdminClient>,
  dailyUser: DailyUser
) {
  try {
    const updateData: SubscriptionUpdateData = {
      subscription_status: 'expired',
      payment_status: 'refunded',
    }

    const { error } = await adminClient
      .from('daily_user')
      .update(updateData)
      .eq('id', dailyUser.id)

    if (error) {
      console.error('[HOTMART WEBHOOK] Erro ao processar reembolso:', error)
      throw error
    }

    console.log('[HOTMART WEBHOOK] Reembolso processado para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handlePurchaseRefunded:', error)
    throw error
  }
}

/**
 * Handler para chargeback
 */
async function handleChargeback(
  adminClient: ReturnType<typeof createAdminClient>,
  dailyUser: DailyUser
) {
  try {
    const updateData: SubscriptionUpdateData = {
      subscription_status: 'expired',
      payment_status: 'failed',
    }

    const { error } = await adminClient
      .from('daily_user')
      .update(updateData)
      .eq('id', dailyUser.id)

    if (error) {
      console.error('[HOTMART WEBHOOK] Erro ao processar chargeback:', error)
      throw error
    }

    console.log('[HOTMART WEBHOOK] Chargeback processado para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handleChargeback:', error)
    throw error
  }
}
