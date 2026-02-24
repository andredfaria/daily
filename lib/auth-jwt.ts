import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

const JWT_SECRET = new TextEncoder().encode(
    process.env.JWT_SECRET || 'fallback-secret-change-this-in-production'
)

const COOKIE_NAME = 'daily_session'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7 // 7 dias em segundos

export interface JWTPayload {
    userId: number
    email: string
    isAdmin: boolean
}

/**
 * Gera um JWT com os dados do usuário
 */
export async function signToken(payload: JWTPayload): Promise<string> {
    return new SignJWT({ ...payload })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('7d')
        .sign(JWT_SECRET)
}

/**
 * Verifica e decodifica um JWT
 */
export async function verifyToken(token: string): Promise<JWTPayload | null> {
    try {
        const { payload } = await jwtVerify(token, JWT_SECRET)
        return {
            userId: payload.userId as number,
            email: payload.email as string,
            isAdmin: payload.isAdmin as boolean,
        }
    } catch {
        return null
    }
}

/**
 * Seta o cookie de sessão na resposta
 */
export async function setSessionCookie(token: string): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: COOKIE_MAX_AGE,
        path: '/',
    })
}

/**
 * Remove o cookie de sessão
 */
export async function clearSessionCookie(): Promise<void> {
    const cookieStore = await cookies()
    cookieStore.set(COOKIE_NAME, '', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 0,
        path: '/',
    })
}

/**
 * Lê e valida o token de sessão do cookie atual
 */
export async function getSessionFromCookies(): Promise<JWTPayload | null> {
    try {
        const cookieStore = await cookies()
        const token = cookieStore.get(COOKIE_NAME)?.value
        if (!token) return null
        return verifyToken(token)
    } catch {
        return null
    }
}
