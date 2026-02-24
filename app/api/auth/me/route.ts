import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById } from '@/lib/db/daily_user'

export async function GET() {
  try {
    const session = await getSessionFromCookies()

    if (!session) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    const user = await getDailyUserById(session.userId)

    if (!user) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        is_admin: user.is_admin,
      },
      dailyUser: user,
    })
  } catch (err) {
    console.error('[AUTH/ME] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao buscar usuário' },
      { status: 500 }
    )
  }
}
