import { NextResponse, type NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

// Compatível com Edge Runtime — usa apenas jose para verificar JWT
const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'fallback-secret-change-this-in-production'
)
const COOKIE_NAME = 'daily_session'

interface JWTPayload {
  userId: number
  phone: string
  isAdmin: boolean
}

async function getSessionFromRequest(request: NextRequest): Promise<JWTPayload | null> {
  try {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (!token) return null
    const { payload } = await jwtVerify(token, JWT_SECRET)
    return {
      userId: payload.userId as number,
      phone: payload.phone as string,
      isAdmin: payload.isAdmin as boolean,
    }
  } catch {
    return null
  }
}

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Permitir acesso livre às rotas de API de autenticação
  if (request.nextUrl.pathname.startsWith('/api/auth')) {
    return response
  }

  const session = await getSessionFromRequest(request)

  // Se não estiver autenticado e não estiver nas páginas públicas → redirecionar para login
  const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password']
  const pathname = request.nextUrl.pathname
  const isPublicPath = publicPaths.some(p => pathname === p || pathname.startsWith(p + '/'))
  const isRootPath = pathname === '/'

  if (!session) {
    if (!isPublicPath && !isRootPath) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return response
  }

  // Usuário autenticado tentando acessar página pública ou raiz → redirecionar
  if (isPublicPath || isRootPath) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Proteger rota /users — apenas admins
  if (request.nextUrl.pathname === '/users') {
    if (!session.isAdmin) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  // Proteger rota /edit — admin ou o próprio usuário
  if (request.nextUrl.pathname === '/edit') {
    const targetUserId = request.nextUrl.searchParams.get('id')
    if (targetUserId) {
      const canEdit = session.isAdmin || session.userId === parseInt(targetUserId)
      if (!canEdit) {
        if (session.isAdmin) {
          return NextResponse.redirect(new URL('/users', request.url))
        }
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|css|js)$).*)',
  ],
}
