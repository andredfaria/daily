import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Permitir acesso às rotas de API de autenticação sem verificação
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return response
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Se não estiver autenticado e não estiver na página de login, redireciona
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/register')) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Se estiver autenticado e tentar acessar /login ou /register, redireciona para home
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const homeUrl = new URL('/', request.url)
    return NextResponse.redirect(homeUrl)
  }

  // Verificação de permissões para a rota /edit
  if (user && request.nextUrl.pathname === '/edit') {
    const targetUserId = request.nextUrl.searchParams.get('id')
    
    if (targetUserId) {
      try {
        // Buscar daily_user do usuário autenticado
        const { data: dailyUser, error: dailyUserError } = await supabase
          .from('daily_user')
          .select('id, is_admin')
          .eq('auth_user_id', user.id)
          .single()

        if (dailyUserError || !dailyUser) {
          // Se não encontrou o daily_user, redireciona para home
          const homeUrl = new URL('/', request.url)
          return NextResponse.redirect(homeUrl)
        }

        // Verificar se pode editar
        const canEdit = dailyUser.is_admin || dailyUser.id === parseInt(targetUserId)

        if (!canEdit) {
          // Se não tem permissão, redireciona para a listagem de usuários
          const usersUrl = new URL('/users', request.url)
          return NextResponse.redirect(usersUrl)
        }
      } catch (error) {
        console.error('Erro ao verificar permissões no middleware:', error)
        // Em caso de erro, permite o acesso e deixa a validação para a página
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
}
