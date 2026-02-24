import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { query } from '@/lib/mysql'
import { DailyData } from '@/lib/types'

/**
 * GET /api/daily-data?userId=X&orderBy=activity_date&orderDirection=desc
 * Busca atividades de um usuário
 */
export async function GET(request: NextRequest) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const { searchParams } = new URL(request.url)
        const userId = searchParams.get('userId')

        if (!userId) {
            return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 })
        }

        const targetUserId = parseInt(userId)

        // Usuários comuns só podem ver suas próprias atividades
        if (!session.isAdmin && session.userId !== targetUserId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const allowedOrder: Record<string, string> = {
            activity_date: 'activity_date',
            created_at: 'created_at',
            id: 'id',
        }
        const orderBy = allowedOrder[searchParams.get('orderBy') ?? ''] ?? 'activity_date'
        const orderDir = searchParams.get('orderDirection') === 'asc' ? 'ASC' : 'DESC'

        const activities = await query<DailyData>(
            `SELECT * FROM daily_data WHERE id_user = ? ORDER BY ${orderBy} ${orderDir}`,
            [targetUserId]
        )

        return NextResponse.json({ activities })
    } catch (error) {
        console.error('[daily-data GET] Erro:', error)
        return NextResponse.json({ error: 'Erro ao buscar atividades' }, { status: 500 })
    }
}
