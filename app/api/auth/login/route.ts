import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDailyUserByPhone } from '@/lib/db/daily_user'
import { signToken, setSessionCookie } from '@/lib/auth-jwt'

export async function POST(request: NextRequest) {
  try {
    const { phone, password } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Telefone e senha são obrigatórios' },
        { status: 400 }
      )
    }

    // Buscar usuário pelo telefone
    const user = await getDailyUserByPhone(phone)

    if (!user) {
      return NextResponse.json(
        { error: 'Telefone ou senha inválidos' },
        { status: 401 }
      )
    }

    // Verificar senha
    const rawUser = user as typeof user & { password_hash?: string }
    if (!rawUser.password_hash) {
      return NextResponse.json(
        { error: 'Conta sem senha configurada. Use o reset de senha.' },
        { status: 401 }
      )
    }

    const passwordValid = await bcrypt.compare(password, rawUser.password_hash)
    if (!passwordValid) {
      return NextResponse.json(
        { error: 'Telefone ou senha inválidos' },
        { status: 401 }
      )
    }

    // Gerar JWT e setar cookie
    const token = await signToken({
      userId: user.id,
      phone: user.phone!,
      isAdmin: Boolean(user.is_admin),
    })

    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        is_admin: user.is_admin,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
      },
      dailyUser: user,
    })
  } catch (err) {
    console.error('[LOGIN] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    )
  }
}
