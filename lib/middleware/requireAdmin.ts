import { NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'

/**
 * Middleware helper para verificar se o usuário autenticado é administrador.
 * Substitui a versão anterior que usava Supabase Auth.
 *
 * @returns NextResponse com erro se não for admin, ou null se for admin
 *
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const adminCheck = await requireAdmin()
 *   if (adminCheck) return adminCheck
 *   // Código que só admins podem executar
 * }
 * ```
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  try {
    const session = await getSessionFromCookies()

    if (!session) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    if (!session.isAdmin) {
      console.warn(`[SECURITY] Usuário não-admin ${session.userId} tentou acessar recurso restrito`)
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar este recurso.' },
        { status: 403 }
      )
    }

    return null
  } catch (error) {
    console.error('Erro ao verificar permissões de admin:', error)
    return NextResponse.json({ error: 'Erro ao verificar permissões' }, { status: 500 })
  }
}
