import { NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isUserAdmin } from '@/lib/supabase-admin'

/**
 * Middleware para verificar se o usuário autenticado é administrador
 * 
 * @returns NextResponse com erro se não for admin, ou null se for admin
 * 
 * @example
 * ```typescript
 * export async function GET(request: NextRequest) {
 *   const adminCheck = await requireAdmin()
 *   if (adminCheck) return adminCheck
 *   
 *   // Código que só admins podem executar
 * }
 * ```
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  try {
    // Verificar autenticação
    const authUser = await getUser()
    
    if (!authUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se é admin
    const isAdmin = await isUserAdmin(authUser.id)
    
    if (!isAdmin) {
      console.warn(`[SECURITY] Usuário não-admin ${authUser.id} tentou acessar recurso restrito`)
      return NextResponse.json(
        { error: 'Acesso negado. Apenas administradores podem acessar este recurso.' },
        { status: 403 }
      )
    }

    // Usuário é admin, permitir acesso
    return null
  } catch (error) {
    console.error('Erro ao verificar permissões de admin:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar permissões' },
      { status: 500 }
    )
  }
}
