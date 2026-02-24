/**
 * lib/server-auth.ts
 * Substitui lib/supabase-server.ts — usa JWT em vez de Supabase Auth
 */
import { getSessionFromCookies, JWTPayload } from '@/lib/auth-jwt'
import { getDailyUserById } from '@/lib/db/daily_user'
import { DailyUser } from '@/lib/types'

/**
 * Retorna o payload do JWT do usuário autenticado, ou null
 */
export async function getSession(): Promise<JWTPayload | null> {
    return getSessionFromCookies()
}

/**
 * Retorna um objeto compatível com o "user" do Supabase para manter compatibilidade
 */
export async function getUser(): Promise<{ id: number; phone: string; isAdmin: boolean } | null> {
    const session = await getSessionFromCookies()
    if (!session) return null
    return {
        id: session.userId,
        phone: session.phone,
        isAdmin: session.isAdmin,
    }
}

/**
 * Retorna o DailyUser completo do banco para o usuário autenticado
 */
export async function getCurrentDailyUser(): Promise<DailyUser | null> {
    const session = await getSessionFromCookies()
    if (!session) return null
    return getDailyUserById(session.userId)
}
