import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDailyUserByEmail, createDailyUser } from '@/lib/db/daily_user'
import { signToken, setSessionCookie } from '@/lib/auth-jwt'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // Verificar se email já existe
    const existing = await getDailyUserByEmail(email)
    if (existing) {
      return NextResponse.json(
        { error: 'Este email já está cadastrado' },
        { status: 400 }
      )
    }

    // Hash da senha
    const password_hash = await bcrypt.hash(password, 12)

    // Criar usuário no MySQL
    const user = await createDailyUser({
      name: name || email.split('@')[0],
      email,
      password_hash,
      phone: phone || null,
      is_admin: false,
      subscription_status: 'trial',
    })

    // Enviar webhook após criação (se configurado)
    const webhookUrl = process.env.USER_CREATED_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'DailySync/1.0' },
          body: JSON.stringify({
            event: 'user.created',
            timestamp: new Date().toISOString(),
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              subscription_status: 'trial',
              trial_ends_at: user.trial_ends_at,
              is_admin: false,
            },
          }),
        })
      } catch (err) {
        console.error('[REGISTER] Erro ao enviar webhook:', err)
      }
    }

    // Login automático após cadastro
    const token = await signToken({
      userId: user.id,
      email: user.email!,
      isAdmin: false,
    })

    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        is_admin: user.is_admin,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
      },
      message: 'Conta criada com sucesso!',
      requiresLogin: false,
    })
  } catch (err) {
    console.error('[REGISTER] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}
