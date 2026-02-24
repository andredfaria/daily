import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById, updateUserEmail } from '@/lib/db/daily_user'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!session.isAdmin) {
      console.warn(`[SECURITY] Usuário não-admin ${session.userId} tentou alterar email`)
      return NextResponse.json({ error: 'Apenas administradores podem alterar emails' }, { status: 403 })
    }

    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') return NextResponse.json({ error: 'Email inválido' }, { status: 400 })

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) return NextResponse.json({ error: 'Formato de email inválido' }, { status: 400 })

    const targetUser = await getDailyUserById(targetUserId)
    if (!targetUser) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    await updateUserEmail(targetUserId, email)

    console.log(`[AUDIT] Admin ${session.email || 'N/A'} (${session.userId}) alterou email do usuário ${targetUserId} para ${email}`)

    return NextResponse.json({ success: true, message: 'Email atualizado com sucesso', new_email: email })
  } catch (error: unknown) {
    console.error('Erro ao atualizar email:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro ao atualizar email' },
      { status: 400 }
    )
  }
}
