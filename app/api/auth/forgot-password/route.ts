import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDailyUserByPhone, setOTPForPhone } from '@/lib/db/daily_user'
import { validatePhoneWithWAHAServer, sendWhatsAppMessage } from '@/lib/waha'
import { normalizePhoneForDB } from '@/lib/utils'
import { createStrictRateLimiter } from '@/lib/middleware/rateLimit'

const rateLimiter = createStrictRateLimiter()

function generateOTP(): string {
  return crypto.randomInt(100000, 999999).toString()
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResult = await rateLimiter(request)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Muitas tentativas. Aguarde um momento antes de tentar novamente.' },
        {
          status: 429,
          headers: { 'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)) },
        }
      )
    }

    const { phone } = await request.json()

    if (!phone) {
      return NextResponse.json(
        { error: 'Número de WhatsApp é obrigatório' },
        { status: 400 }
      )
    }

    // Validar número no WhatsApp via WAHA
    const wahaResult = await validatePhoneWithWAHAServer(phone)
    if (!wahaResult.exists || !wahaResult.chatId) {
      return NextResponse.json(
        { error: 'Número não encontrado no WhatsApp. Verifique o número e tente novamente.' },
        { status: 400 }
      )
    }

    // Normalizar telefone para busca no DB
    const normalizedPhone = normalizePhoneForDB(phone)
    const user = await getDailyUserByPhone(normalizedPhone)

    // Por segurança, retornar sucesso mesmo que o usuário não exista
    if (!user) {
      return NextResponse.json({
        message: 'Se o número estiver cadastrado, você receberá um código no WhatsApp.',
      })
    }

    // Gerar OTP de 6 dígitos (válido por 15 minutos)
    const otp = generateOTP()
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000)

    await setOTPForPhone(normalizedPhone, otp, expiresAt)

    // Enviar OTP via WhatsApp
    const message =
      `🔐 *Código de verificação DailySync*\n\n` +
      `Seu código é: *${otp}*\n\n` +
      `Válido por 15 minutos. Não compartilhe este código com ninguém.`

    await sendWhatsAppMessage(wahaResult.chatId, message)

    return NextResponse.json({
      message: 'Código enviado para seu WhatsApp!',
      // Retorna o chatId formatado para o frontend (sem @c.us)
      phone: wahaResult.validatedPhone,
    })
  } catch (err) {
    console.error('[FORGOT PASSWORD] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}
