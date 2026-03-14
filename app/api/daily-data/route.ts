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

        const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'))
        const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '90')), 365)
        const offset = (page - 1) * limit

        const [activities, countRows] = await Promise.all([
            query<DailyData>(
                `SELECT * FROM daily_data WHERE id_user = ? ORDER BY ${orderBy} ${orderDir} LIMIT ? OFFSET ?`,
                [targetUserId, limit, offset]
            ),
            query<{ total: number }>(
                'SELECT COUNT(*) as total FROM daily_data WHERE id_user = ?',
                [targetUserId]
            ),
        ])

        const total = countRows[0]?.total ?? 0

        return NextResponse.json({ activities, total, page, limit })
    } catch (error) {
        console.error('[daily-data GET] Erro:', error)
        return NextResponse.json({ error: 'Erro ao buscar atividades' }, { status: 500 })
    }
}
