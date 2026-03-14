import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserByResetToken, updateUserPassword, clearResetToken } from '@/lib/db/daily_user'

export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json()

    if (!token || !password) {
      return NextResponse.json(
        { error: 'Token e nova senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // Busca usuário pelo token (já verifica expiração: reset_token_expires_at > NOW())
    const user = await getUserByResetToken(token)

    if (!user) {
      return NextResponse.json(
        { error: 'Link inválido ou expirado. Solicite um novo link de recuperação.' },
        { status: 400 }
      )
    }

    const passwordHash = await bcrypt.hash(password, 12)

    await updateUserPassword(user.id, passwordHash)
    await clearResetToken(user.id)

    return NextResponse.json({
      message: 'Senha redefinida com sucesso. Faça login com sua nova senha.',
    })
  } catch (err) {
    console.error('[RESET PASSWORD] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao redefinir senha' },
      { status: 500 }
    )
  }
}
