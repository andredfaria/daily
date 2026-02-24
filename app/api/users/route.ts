import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { listDailyUsers, insertDailyUserSimple } from '@/lib/db/daily_user'

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
      users: data,
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

/**
 * POST /api/users
 * Cria um novo usuário/lead (apenas admins)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSessionFromCookies()
    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }
    if (!session.isAdmin) {
      return NextResponse.json({ error: 'Apenas administradores podem criar usuários' }, { status: 403 })
    }

    const body = await request.json()

    const user = await insertDailyUserSimple(body)

    return NextResponse.json({
      success: true,
      message: 'Usuário criado com sucesso',
      user,
      id: user.id,
    }, { status: 201 })
  } catch (error) {
    console.error('Erro ao criar usuário:', error)
    const message = error instanceof Error ? error.message : 'Erro ao criar usuário'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
