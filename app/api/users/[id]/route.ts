import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById } from '@/lib/db/daily_user'

/**
 * GET /api/users/[id]
 * Retorna um usuário pelo ID
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const userId = parseInt(params.id)
        if (isNaN(userId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
        }

        // Usuários comuns só podem ver seus próprios dados
        if (!session.isAdmin && session.userId !== userId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const user = await getDailyUserById(userId)
        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        return NextResponse.json(user)
    } catch (error) {
        console.error('[users/[id] GET] Erro:', error)
        return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    }
}
