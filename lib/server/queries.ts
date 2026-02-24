import { cache } from 'react'
import { getDailyUserById, listDailyUsers } from '@/lib/db/daily_user'
import { query } from '@/lib/mysql'
import { DailyUser, DailyData } from '@/lib/types'

/**
 * Busca um usuário por ID com cache do React
 */
export const getUserById = cache(async (userId: string | number): Promise<DailyUser> => {
    const user = await getDailyUserById(Number(userId))
    if (!user) throw new Error('Usuário não encontrado')
    return user
})

/**
 * Busca atividades de um usuário com limite e cache
 */
export const getUserActivities = cache(async (userId: string | number, limit = 100): Promise<DailyData[]> => {
    const rows = await query<DailyData>(
        'SELECT * FROM daily_data WHERE id_user = ? ORDER BY activity_date DESC LIMIT ?',
        [Number(userId), limit]
    )
    return rows
})

/**
 * Busca dados completos do dashboard em paralelo
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
 */
export const getUsers = cache(async (page = 1, pageSize = 50) => {
    const { data: users, total } = await listDailyUsers({ page, limit: pageSize })
    return {
        users,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
    }
})
