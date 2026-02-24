import { query, execute, DBValue } from '@/lib/mysql'
import { DailyUser, SubscriptionUpdateData } from '@/lib/types'

// ─── Busca por auth ───────────────────────────────────────────

export async function getDailyUserByEmail(email: string): Promise<DailyUser | null> {
    const rows = await query<DailyUser & { password_hash?: string }>(
        'SELECT * FROM daily_user WHERE email = ? LIMIT 1',
        [email]
    )
    return rows[0] || null
}

export async function getDailyUserByPhone(phone: string): Promise<DailyUser | null> {
    const rows = await query<DailyUser & { password_hash?: string }>(
        'SELECT * FROM daily_user WHERE phone = ? LIMIT 1',
        [phone]
    )
    return rows[0] || null
}

export async function getDailyUserById(id: number): Promise<DailyUser | null> {
    const rows = await query<DailyUser>(
        'SELECT * FROM daily_user WHERE id = ? LIMIT 1',
        [id]
    )
    return rows[0] || null
}

// ─── Verificações ─────────────────────────────────────────────

export async function isAdmin(userId: number): Promise<boolean> {
    const rows = await query<{ is_admin: number }>(
        'SELECT is_admin FROM daily_user WHERE id = ? LIMIT 1',
        [userId]
    )
    return rows[0]?.is_admin === 1
}

// ─── Criação ──────────────────────────────────────────────────

export interface CreateUserData {
    name: string
    email: string
    password_hash: string
    phone?: string | null
    is_admin?: boolean
    subscription_status?: string
    trial_ends_at?: Date | null
}

export async function createDailyUser(data: CreateUserData): Promise<DailyUser> {
    const trialEndsAt = data.trial_ends_at ?? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

    const result = await execute(
        `INSERT INTO daily_user
      (name, email, password_hash, phone, is_admin, subscription_status, trial_ends_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
            data.name,
            data.email,
            data.password_hash,
            data.phone ?? null,
            data.is_admin ? 1 : 0,
            data.subscription_status ?? 'trial',
            trialEndsAt,
        ]
    )

    const user = await getDailyUserById(result.insertId)
    if (!user) throw new Error('Usuário não encontrado após criação')
    return user
}

// ─── Atualização ──────────────────────────────────────────────

export async function updateDailyUser(id: number, data: Partial<DailyUser & { password_hash?: string }>): Promise<void> {
    const fields: string[] = []
    const values: DBValue[] = []

    const allowed = [
        'name', 'email', 'password_hash', 'phone', 'title', 'option',
        'time_to_send', 'subscription_status', 'trial_ends_at',
        'subscription_ends_at', 'subscription_plan', 'payment_provider',
        'payment_customer_id', 'payment_subscription_id', 'payment_status',
        'next_billing_date', 'reset_token', 'reset_token_expires_at',
    ]

    for (const key of allowed) {
        if (key in data) {
            fields.push(`${key} = ?`)
            const val = (data as Record<string, unknown>)[key]
            // Converte boolean para tinyint
            values.push((typeof val === 'boolean' ? (val ? 1 : 0) : val) as DBValue)
        }
    }

    if (fields.length === 0) return

    values.push(id)
    await execute(`UPDATE daily_user SET ${fields.join(', ')} WHERE id = ?`, values)
}

export async function updateAdminStatus(id: number, isAdmin: boolean): Promise<DailyUser> {
    await execute('UPDATE daily_user SET is_admin = ? WHERE id = ?', [isAdmin ? 1 : 0, id])
    const user = await getDailyUserById(id)
    if (!user) throw new Error('Usuário não encontrado')
    return user
}

export async function updateSubscription(id: number, data: SubscriptionUpdateData): Promise<void> {
    await updateDailyUser(id, data as Partial<DailyUser>)
}

export async function updateUserEmail(id: number, email: string): Promise<void> {
    await execute('UPDATE daily_user SET email = ? WHERE id = ?', [email, id])
}

export async function updateUserPassword(id: number, passwordHash: string): Promise<void> {
    await execute('UPDATE daily_user SET password_hash = ? WHERE id = ?', [passwordHash, id])
}

export async function setResetToken(email: string, token: string, expiresAt: Date): Promise<void> {
    await execute(
        'UPDATE daily_user SET reset_token = ?, reset_token_expires_at = ? WHERE email = ?',
        [token, expiresAt, email]
    )
}

export async function clearResetToken(id: number): Promise<void> {
    await execute(
        'UPDATE daily_user SET reset_token = NULL, reset_token_expires_at = NULL WHERE id = ?',
        [id]
    )
}

export async function getUserByResetToken(token: string): Promise<DailyUser | null> {
    const rows = await query<DailyUser>(
        'SELECT * FROM daily_user WHERE reset_token = ? AND reset_token_expires_at > NOW() LIMIT 1',
        [token]
    )
    return rows[0] || null
}

// ─── Buscas por pagamento ─────────────────────────────────────

export async function getDailyUserByPaymentSubscriptionId(subscriptionId: string): Promise<DailyUser | null> {
    const rows = await query<DailyUser>(
        'SELECT * FROM daily_user WHERE payment_subscription_id = ? LIMIT 1',
        [subscriptionId]
    )
    return rows[0] || null
}

export async function getDailyUserByPaymentCustomerOrSubscription(
    customerId: string,
    subscriptionId: string
): Promise<DailyUser | null> {
    const rows = await query<DailyUser>(
        'SELECT * FROM daily_user WHERE payment_customer_id = ? OR payment_subscription_id = ? LIMIT 1',
        [customerId, subscriptionId]
    )
    return rows[0] || null
}

// ─── Exclusão ─────────────────────────────────────────────────

export async function deleteDailyUser(id: number): Promise<void> {
    await execute('DELETE FROM daily_user WHERE id = ?', [id])
}

// ─── Inserção simples (admin lead creation, sem senha) ────────

export async function insertDailyUserSimple(data: Record<string, unknown>): Promise<DailyUser> {
    const fields: string[] = []
    const placeholders: string[] = []
    const values: DBValue[] = []

    const allowed = [
        'name', 'email', 'phone', 'title', 'option',
        'time_to_send', 'subscription_status', 'trial_ends_at',
    ]

    for (const key of allowed) {
        if (key in data && data[key] !== undefined) {
            fields.push(key)
            placeholders.push('?')
            const val = data[key]
            values.push((typeof val === 'boolean' ? (val ? 1 : 0) : val) as DBValue)
        }
    }

    if (fields.length === 0) {
        throw new Error('Nenhum campo fornecido para criação')
    }

    const result = await execute(
        `INSERT INTO daily_user (${fields.join(', ')}) VALUES (${placeholders.join(', ')})`,
        values
    )

    const user = await getDailyUserById(result.insertId)
    if (!user) throw new Error('Usuário não encontrado após criação')
    return user
}

// ─── Listagem ─────────────────────────────────────────────────

export interface ListUsersOptions {
    page?: number
    limit?: number
    orderBy?: string
    orderDirection?: 'asc' | 'desc'
}

export async function listDailyUsers(opts: ListUsersOptions = {}): Promise<{ data: DailyUser[]; total: number }> {
    const page = opts.page ?? 1
    const limit = Math.min(opts.limit ?? 50, 100)
    const offset = (page - 1) * limit
    const allowedOrder = ['id', 'created_at', 'name', 'email', 'subscription_status']
    const orderBy = allowedOrder.includes(opts.orderBy ?? '') ? opts.orderBy : 'created_at'
    const dir = opts.orderDirection === 'asc' ? 'ASC' : 'DESC'

    const [data, countRows] = await Promise.all([
        query<DailyUser>(
            `SELECT * FROM daily_user ORDER BY ${orderBy} ${dir} LIMIT ? OFFSET ?`,
            [limit, offset]
        ),
        query<{ total: number }>('SELECT COUNT(*) as total FROM daily_user'),
    ])

    return { data, total: countRows[0]?.total ?? 0 }
}
