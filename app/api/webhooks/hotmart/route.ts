import { NextRequest, NextResponse } from 'next/server'
import { validateHotmartToken } from '@/lib/hotmart'
import { DailyUser, SubscriptionUpdateData } from '@/lib/types'
import {
  getDailyUserByEmail,
  updateDailyUser
} from '@/lib/db/daily_user'

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
    const event = payload.event || payload.data?.event ||
      (payload.data?.subscription?.status && 'SUBSCRIPTION_UPDATE') ||
      (payload.status === 'APPROVED' && 'PURCHASE_APPROVED') ||
      'UNKNOWN'

    console.log('[HOTMART WEBHOOK] Tipo de evento:', event)

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

    // Buscar usuário por email no MySQL
    const dailyUser = await getDailyUserByEmail(buyerEmail)

    if (!dailyUser) {
      // Usuário pode ter se cadastrado apenas com telefone (email opcional).
      // Registrar o evento para resolução manual e retornar 200 para evitar
      // retentativas infinitas da Hotmart.
      console.error(
        '[HOTMART WEBHOOK] Usuário não encontrado para email:', buyerEmail,
        '| Evento:', event,
        '| subscriberCode:', subscriberCode,
        '| Ação: verificar cadastro e vincular manualmente se necessário.'
      )
      return NextResponse.json({
        message: 'Usuário não encontrado. Evento registrado para revisão manual.',
        buyerEmail,
        event,
      })
    }

    // Processar eventos
    switch (event) {
      case 'PURCHASE_APPROVED':
      case 'APPROVED':
        await handlePurchaseApproved(dailyUser, {
          subscriberCode,
          transactionValue,
          productId,
        })
        break

      case 'SUBSCRIPTION_CANCELLED':
      case 'CANCELLED':
        await handleSubscriptionCancelled(dailyUser)
        break

      case 'PURCHASE_REFUNDED':
      case 'REFUNDED':
        await handlePurchaseRefunded(dailyUser)
        break

      case 'CHARGEBACK':
        await handleChargeback(dailyUser)
        break

      default:
        console.warn('[HOTMART WEBHOOK] Evento não tratado:', event)
    }

    return NextResponse.json({
      success: true,
      message: 'Webhook processado com sucesso',
      event,
    })
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro ao processar webhook:', error)

    return NextResponse.json(
      {
        error: 'Erro ao processar webhook',
        message: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    )
  }
}

/**
 * Handler para compra aprovada / assinatura ativada
 */
async function handlePurchaseApproved(
  dailyUser: DailyUser,
  data: { subscriberCode?: string; transactionValue?: number; productId?: string }
) {
  try {
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

    if (data.subscriberCode) {
      updateData.payment_subscription_id = data.subscriberCode
    }

    await updateDailyUser(dailyUser.id, updateData as Record<string, unknown>)

    console.log('[HOTMART WEBHOOK] Assinatura ativada para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handlePurchaseApproved:', error)
    throw error
  }
}

/**
 * Handler para assinatura cancelada
 */
async function handleSubscriptionCancelled(dailyUser: DailyUser) {
  try {
    await updateDailyUser(dailyUser.id, {
      subscription_status: 'cancelled',
      payment_status: 'cancelled',
    })

    console.log('[HOTMART WEBHOOK] Assinatura cancelada para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handleSubscriptionCancelled:', error)
    throw error
  }
}

/**
 * Handler para reembolso
 */
async function handlePurchaseRefunded(dailyUser: DailyUser) {
  try {
    await updateDailyUser(dailyUser.id, {
      subscription_status: 'expired',
      payment_status: 'refunded',
    })

    console.log('[HOTMART WEBHOOK] Reembolso processado para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handlePurchaseRefunded:', error)
    throw error
  }
}

/**
 * Handler para chargeback
 */
async function handleChargeback(dailyUser: DailyUser) {
  try {
    await updateDailyUser(dailyUser.id, {
      subscription_status: 'expired',
      payment_status: 'failed',
    })

    console.log('[HOTMART WEBHOOK] Chargeback processado para usuário:', dailyUser.id)
  } catch (error) {
    console.error('[HOTMART WEBHOOK] Erro em handleChargeback:', error)
    throw error
  }
}
