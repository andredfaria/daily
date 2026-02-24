import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById, updateUserPassword } from '@/lib/db/daily_user'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!session.isAdmin) {
      console.warn(`[SECURITY] Usuário não-admin ${session.userId} tentou alterar senha`)
      return NextResponse.json({ error: 'Apenas administradores podem alterar senhas' }, { status: 403 })
    }

    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') return NextResponse.json({ error: 'Senha inválida' }, { status: 400 })
    if (password.length < 8) return NextResponse.json({ error: 'A senha deve ter no mínimo 8 caracteres' }, { status: 400 })

    const targetUser = await getDailyUserById(targetUserId)
    if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const passwordHash = await bcrypt.hash(password, 12)
    await updateUserPassword(targetUserId, passwordHash)

    console.log(`[AUDIT] Admin ${session.email} (${session.userId}) alterou senha do usuário ${targetUserId}`)

    return NextResponse.json({ success: true, message: 'Senha atualizada com sucesso' })
  } catch (error: unknown) {
    console.error('Erro ao atualizar senha:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar senha' },
      { status: 400 }
    )
  }
}
