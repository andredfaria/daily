import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { updateAdminStatus } from '@/lib/db/daily_user'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!session.isAdmin) {
      console.warn(`[SECURITY] Usuário não-admin ${session.userId} tentou alterar permissões`)
      return NextResponse.json({ error: 'Apenas administradores podem alterar permissões' }, { status: 403 })
    }

    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) {
      return NextResponse.json({ error: 'ID de usuário inválido' }, { status: 400 })
    }

    const body = await request.json()
    const { is_admin } = body

    if (typeof is_admin !== 'boolean') {
      return NextResponse.json({ error: 'Valor de is_admin inválido. Deve ser boolean.' }, { status: 400 })
    }

    const updatedUser = await updateAdminStatus(targetUserId, is_admin)

    console.log(`[AUDIT] Admin ${session.email} (${session.userId}) alterou is_admin do usuário ${targetUserId} para ${is_admin}`)

    return NextResponse.json({
      success: true,
      message: `Usuário ${is_admin ? 'promovido a' : 'removido de'} administrador com sucesso`,
      user: updatedUser,
    })
  } catch (error: unknown) {
    console.error('Erro ao atualizar permissões:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar permissões' },
      { status: 500 }
    )
  }
}
