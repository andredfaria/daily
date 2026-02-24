import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById, getDailyUserByPhone, updateDailyUser, deleteDailyUser } from '@/lib/db/daily_user'

/**
 * GET /api/users/[id]
 * Retorna um usuário pelo ID
 */
export async function GET(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const userId = parseInt(params.id)
        if (isNaN(userId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
        }

        // Usuários comuns só podem ver seus próprios dados
        if (!session.isAdmin && session.userId !== userId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const user = await getDailyUserById(userId)
        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        return NextResponse.json(user)
    } catch (error) {
        console.error('[users/[id] GET] Erro:', error)
        return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
    }
}

/**
 * PUT /api/users/[id]
 * Atualiza dados de um usuário com controle de acesso:
 * - Admin: pode editar qualquer usuário (campos seguros)
 * - Non-admin: pode editar apenas seus próprios dados (campos limitados)
 * - is_admin nunca pode ser alterado por esta rota
 */
export async function PUT(
    request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        const targetUserId = parseInt(params.id)
        if (isNaN(targetUserId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
        }

        // Non-admin só pode editar seus próprios dados
        if (!session.isAdmin && session.userId !== targetUserId) {
            return NextResponse.json({ error: 'Acesso negado' }, { status: 403 })
        }

        const existingUser = await getDailyUserById(targetUserId)
        if (!existingUser) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        const body = await request.json()

        // Campos que non-admin pode editar
        const safeFields = ['name', 'title', 'phone', 'option', 'time_to_send']
        // Campos adicionais que admin pode editar
        const adminFields = [...safeFields, 'email', 'subscription_status', 'trial_ends_at',
            'subscription_ends_at', 'subscription_plan', 'payment_provider',
            'payment_customer_id', 'payment_subscription_id', 'payment_status',
            'next_billing_date']

        const allowedFields = session.isAdmin ? adminFields : safeFields

        // Filtrar apenas campos permitidos
        const updateData: Record<string, unknown> = {}
        for (const field of allowedFields) {
            if (field in body) {
                updateData[field] = body[field]
            }
        }

        // NUNCA permitir is_admin via esta rota (somente via admin/update-role)
        delete updateData['is_admin']

        if (Object.keys(updateData).length === 0) {
            return NextResponse.json({ error: 'Nenhum campo válido para atualizar' }, { status: 400 })
        }

        // Se phone foi alterado, verificar unicidade
        if (updateData.phone && updateData.phone !== existingUser.phone) {
            const phoneExists = await getDailyUserByPhone(updateData.phone as string)
            if (phoneExists && phoneExists.id !== targetUserId) {
                return NextResponse.json({ error: 'Este telefone já está em uso' }, { status: 400 })
            }
        }

        await updateDailyUser(targetUserId, updateData)

        const updatedUser = await getDailyUserById(targetUserId)

        return NextResponse.json({
            success: true,
            message: 'Usuário atualizado com sucesso',
            user: updatedUser,
        })
    } catch (error) {
        console.error('[users/[id] PUT] Erro:', error)
        return NextResponse.json({ error: 'Erro ao atualizar usuário' }, { status: 500 })
    }
}

/**
 * DELETE /api/users/[id]
 * Exclui um usuário (apenas admins)
 */
export async function DELETE(
    _request: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const session = await getSessionFromCookies()
        if (!session) {
            return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
        }

        if (!session.isAdmin) {
            return NextResponse.json({ error: 'Apenas administradores podem excluir usuários' }, { status: 403 })
        }

        const userId = parseInt(params.id)
        if (isNaN(userId)) {
            return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
        }

        const user = await getDailyUserById(userId)
        if (!user) {
            return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
        }

        await deleteDailyUser(userId)

        return NextResponse.json({
            success: true,
            message: 'Usuário excluído com sucesso',
        })
    } catch (error) {
        console.error('[users/[id] DELETE] Erro:', error)
        return NextResponse.json({ error: 'Erro ao excluir usuário' }, { status: 500 })
    }
}
