import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { getDailyUserByEmail, setResetToken } from '@/lib/db/daily_user'

export async function POST(request: NextRequest) {
  try {
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

    // Enviar email (via serviço externo ou SMTP — adapte conforme necessário)
    // Por ora, logamos o link no console para facilitar testes iniciais
    console.log(`[RESET PASSWORD] Link para ${email}: ${resetLink}`)

    // TODO: integrar com serviço de envio de email (SendGrid, Resend, SMTP, etc.)
    // Exemplo com Resend:
    // await resend.emails.send({ to: email, subject: 'Reset de senha', html: `<a href="${resetLink}">Redefinir senha</a>` })

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
