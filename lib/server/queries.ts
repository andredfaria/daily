import { cache } from 'react'
import { createServerSupabaseClient } from './supabase'
import { DailyUser, DailyData } from '@/lib/types'

/**
 * Busca um usuário por ID com cache do React
 * O cache persiste durante toda a requisição do servidor
 */
export const getUserById = cache(async (userId: string | number) => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
        .from('daily_user')
        .select('*')
        .eq('id', userId)
        .single()

    if (error) throw error
    if (!data) throw new Error('Usuário não encontrado')

    return data as DailyUser
})

/**
 * Busca atividades de um usuário com limite e cache
 * @param userId - ID do usuário
 * @param limit - Número máximo de atividades (padrão: 100)
 */
export const getUserActivities = cache(async (userId: string | number, limit = 100) => {
    const supabase = await createServerSupabaseClient()

    const { data, error } = await supabase
        .from('daily_data')
        .select('*')
        .eq('id_user', userId)
        .order('activity_date', { ascending: false })
        .limit(limit)

    if (error) throw error

    return (data as DailyData[]) || []
})

/**
 * Busca dados completos do dashboard em paralelo
 * Otimização: executa queries de usuário e atividades simultaneamente
 */
export const getDashboardData = cache(async (userId: string | number) => {
    const [user, activities] = await Promise.all([
        getUserById(userId),
        getUserActivities(userId, 100)
    ])

    return { user, activities }
})

/**
 * Lista usuários com paginação
 * @param page - Número da página (começa em 1)
 * @param pageSize - Tamanho da página
 */
export const getUsers = cache(async (page = 1, pageSize = 50) => {
    const supabase = await createServerSupabaseClient()
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data, error, count } = await supabase
        .from('daily_user')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)

    if (error) throw error

    return {
        users: (data as DailyUser[]) || [],
        total: count || 0,
        page,
        pageSize,
        totalPages: Math.ceil((count || 0) / pageSize)
    }
})

/**
 * Busca usuário autenticado atual
 */
export const getCurrentUser = cache(async () => {
    const supabase = await createServerSupabaseClient()

    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
        return null
    }

    const { data, error } = await supabase
        .from('daily_user')
        .select('*')
        .eq('auth_user_id', authUser.id)
        .single()

    if (error) return null

    return data as DailyUser
})
