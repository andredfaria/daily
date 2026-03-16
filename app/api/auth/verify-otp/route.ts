import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getUserByPhoneAndOTP, setResetTokenForUser } from '@/lib/db/daily_user'
import { normalizePhoneForDB } from '@/lib/utils'
import { createStrictRateLimiter } from '@/lib/middleware/rateLimit'

const rateLimiter = createStrictRateLimiter()

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

    const { phone, otp } = await request.json()

    if (!phone || !otp) {
      return NextResponse.json(
        { error: 'Telefone e código OTP são obrigatórios' },
        { status: 400 }
      )
    }

    const cleanOTP = String(otp).trim()
    if (!/^\d{6}$/.test(cleanOTP)) {
      return NextResponse.json(
        { error: 'Código inválido. O código deve ter 6 dígitos.' },
        { status: 400 }
      )
    }

    const normalizedPhone = normalizePhoneForDB(phone)
    const user = await getUserByPhoneAndOTP(normalizedPhone, cleanOTP)

    if (!user) {
      return NextResponse.json(
        { error: 'Código inválido ou expirado. Solicite um novo código.' },
        { status: 400 }
      )
    }

    // OTP válido: gera token de reset de senha (válido por 30 minutos)
    const resetToken = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000)

    await setResetTokenForUser(user.id, resetToken, expiresAt)

    return NextResponse.json({ resetToken })
  } catch (err) {
    console.error('[VERIFY OTP] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao verificar código' },
      { status: 500 }
    )
  }
}
