import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { Resend } from 'resend'
import { getDailyUserByEmail, setResetToken } from '@/lib/db/daily_user'
import { createStrictRateLimiter } from '@/lib/middleware/rateLimit'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
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

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    const user = await getDailyUserByEmail(email)

    // Por segurança, sempre retornar sucesso (não revelar se email existe)
    if (!user) {
      return NextResponse.json({
        message: 'Se o email existir, você receberá um link para redefinir sua senha.',
      })
    }

    // Gerar token de reset
    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hora

    await setResetToken(email, token, expiresAt)

    // Montar link de reset
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const resetLink = `${origin}/reset-password?token=${token}`

    if (resend) {
      await resend.emails.send({
        from: process.env.EMAIL_FROM || 'DailySync <noreply@dailysync.app>',
        to: email,
        subject: 'Redefinição de senha — DailySync',
        html: `
          <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto;">
            <h2 style="color: #10b981;">Redefinição de senha</h2>
            <p>Recebemos uma solicitação para redefinir a senha da sua conta DailySync.</p>
            <p>Clique no botão abaixo para criar uma nova senha. O link é válido por <strong>1 hora</strong>.</p>
            <a href="${resetLink}" style="display:inline-block;background:#10b981;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin:16px 0;">
              Redefinir senha
            </a>
            <p style="color:#888;font-size:13px;">Se você não solicitou isso, ignore este email.</p>
            <p style="color:#888;font-size:12px;">Ou copie este link: ${resetLink}</p>
          </div>
        `,
      })
    } else {
      // Fallback para desenvolvimento sem RESEND_API_KEY configurado
      console.log(`[RESET PASSWORD] Link para ${email}: ${resetLink}`)
    }

    return NextResponse.json({
      message: 'Se o email existir, você receberá um link para redefinir sua senha.',
    })
  } catch (err) {
    console.error('[FORGOT PASSWORD] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}
