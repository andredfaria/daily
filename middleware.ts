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
  if (!user && !request.nextUrl.pathname.startsWith('/login') && !request.nextUrl.pathname.startsWith('/register') && request.nextUrl.pathname !== '/') {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Se estiver autenticado e tentar acessar /, /login ou /register, redireciona baseado no tipo de usuário
  if (user && (request.nextUrl.pathname === '/' || request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    try {
      // Buscar daily_user para determinar o redirecionamento correto
      const { data: dailyUser, error: dailyUserError } = await supabase
        .from('daily_user')
        .select('id, is_admin, subscription_status, trial_ends_at, subscription_ends_at')
        .eq('auth_user_id', user.id)
        .single()

      if (dailyUser && !dailyUserError) {
        if (dailyUser.is_admin) {
          // Admin vai para dashboard
          const dashboardUrl = new URL('/dashboard', request.url)
          return NextResponse.redirect(dashboardUrl)
        } else {
          // Usuário comum: verificar se trial/assinatura está ativa
          const now = new Date()
          const isActive = dailyUser.subscription_status === 'active' || 
            (dailyUser.subscription_status === 'trial' && 
             dailyUser.trial_ends_at && 
             new Date(dailyUser.trial_ends_at) > now)
          
          if (isActive) {
            // Redirecionar para dashboard com o próprio ID (tela de leads própria)
            const dashboardUrl = new URL(`/dashboard?id=${dailyUser.id}`, request.url)
            return NextResponse.redirect(dashboardUrl)
          } else {
            // Trial expirado ou sem assinatura: redirecionar para tela de upgrade (se existir)
            // Por enquanto, redireciona para dashboard mesmo (pode mostrar bloqueio lá)
            const dashboardUrl = new URL('/dashboard', request.url)
            return NextResponse.redirect(dashboardUrl)
          }
        }
      } else {
        // daily_user não encontrado - não criar aqui (será criado pelo AuthProvider ou API)
        // Apenas redirecionar para dashboard onde a vinculação será garantida
        console.warn('[MIDDLEWARE] daily_user não encontrado para auth_user_id:', user.id)
        const dashboardUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(dashboardUrl)
      }
    } catch (error) {
      console.error('[MIDDLEWARE] Erro ao verificar usuário:', error)
      // Em caso de erro, redireciona para dashboard como padrão
      // A vinculação será garantida pelo AuthProvider ou API
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }
  }

  // Proteger rota /users - apenas admins podem acessar
  if (user && request.nextUrl.pathname === '/users') {
    try {
      const { data: dailyUser, error: dailyUserError } = await supabase
        .from('daily_user')
        .select('id, is_admin')
        .eq('auth_user_id', user.id)
        .single()

      if (dailyUserError || !dailyUser) {
        // daily_user não encontrado - redirecionar para dashboard onde será criado
        console.warn('[MIDDLEWARE] daily_user não encontrado ao verificar /users:', user.id)
        const dashboardUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(dashboardUrl)
      }

      if (!dailyUser.is_admin) {
        // Usuário comum: redirecionar para seu próprio dashboard
        const dashboardUrl = new URL(`/dashboard?id=${dailyUser.id}`, request.url)
        return NextResponse.redirect(dashboardUrl)
      }
    } catch (error) {
      console.error('[MIDDLEWARE] Erro ao verificar permissões:', error)
      // Em caso de erro, redireciona para dashboard
      const dashboardUrl = new URL('/dashboard', request.url)
      return NextResponse.redirect(dashboardUrl)
    }
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
          // Se não encontrou o daily_user, redireciona para dashboard onde será criado
          console.warn('[MIDDLEWARE] daily_user não encontrado ao verificar /edit:', user.id)
          const dashboardUrl = new URL('/dashboard', request.url)
          return NextResponse.redirect(dashboardUrl)
        }

        // Verificar se pode editar
        const canEdit = dailyUser.is_admin || dailyUser.id === parseInt(targetUserId)

        if (!canEdit) {
          // Se não tem permissão, redireciona para a listagem de usuários ou seu próprio dashboard
          if (dailyUser.is_admin) {
            const usersUrl = new URL('/users', request.url)
            return NextResponse.redirect(usersUrl)
          } else {
            const dashboardUrl = new URL(`/dashboard?id=${dailyUser.id}`, request.url)
            return NextResponse.redirect(dashboardUrl)
          }
        }
      } catch (error) {
        console.error('[MIDDLEWARE] Erro ao verificar permissões em /edit:', error)
        // Em caso de erro, redireciona para dashboard
        const dashboardUrl = new URL('/dashboard', request.url)
        return NextResponse.redirect(dashboardUrl)
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
