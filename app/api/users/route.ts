import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase-server'
import { createRateLimiter } from '@/lib/middleware/rateLimit'
import { sanitizeId } from '@/lib/utils/sanitize'

const rateLimiter = createRateLimiter()

/**
 * GET /api/users
 * Lista usuários com paginação opcional
 */
export async function GET(request: NextRequest) {
  try {
    // Verificar se usuário é admin
    const { requireAdmin } = await import('@/lib/middleware/requireAdmin')
    const adminCheck = await requireAdmin()
    if (adminCheck) return adminCheck

    // Rate limiting
    const rateLimitResult = await rateLimiter(request)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Muitas requisições. Tente novamente mais tarde.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
            'X-RateLimit-Limit': '100',
            'X-RateLimit-Remaining': String(rateLimitResult.remaining),
            'X-RateLimit-Reset': String(rateLimitResult.resetAt),
          },
        }
      )
    }

    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Paginação
    const page = sanitizeId(searchParams.get('page')) || 1
    const limit = Math.min(sanitizeId(searchParams.get('limit')) || 50, 100) // Max 100
    const offset = (page - 1) * limit

    // Ordenação
    const orderBy = searchParams.get('orderBy') || 'created_at'
    const orderDirection = searchParams.get('orderDirection') === 'asc' ? 'asc' : 'desc'

    // Query
    const { data, error, count } = await supabase
      .from('daily_user')
      .select('*', { count: 'exact' })
      .order(orderBy, { ascending: orderDirection === 'asc' })
      .range(offset, offset + limit - 1)

    if (error) throw error

    return NextResponse.json({
      data: data || [],
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit),
      },
    })
  } catch (error) {
    console.error('Erro ao listar usuários:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar usuários' },
      { status: 500 }
    )
  }
}
