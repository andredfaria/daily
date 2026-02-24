import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById } from '@/lib/db/daily_user'

// Vinculação de auth_user agora é o próprio ID do usuário MySQL
// Este endpoint foi simplificado — mantido para compatibilidade
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!session.isAdmin) return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })

    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const user = await getDailyUserById(targetUserId)
    if (!user) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    return NextResponse.json({ success: true, message: 'Operação concluída', user })
  } catch (error: unknown) {
    console.error('Erro no link-auth:', error)
    return NextResponse.json({ error: 'Erro na operação' }, { status: 400 })
  }
}
