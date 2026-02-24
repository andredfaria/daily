import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { listDailyUsers } from '@/lib/db/daily_user'

/**
 * GET /api/users
 * Lista usuários com paginação (apenas admins)
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação e permissão de admin
    const session = await getSessionFromCookies()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const orderBy = searchParams.get('orderBy') || 'created_at'
    const orderDirection = (searchParams.get('orderDirection') || 'desc') as 'asc' | 'desc'

    const { data, total } = await listDailyUsers({ page, limit, orderBy, orderDirection })

    return NextResponse.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json({ error: 'Erro ao buscar usuários' }, { status: 500 })
  }
}
