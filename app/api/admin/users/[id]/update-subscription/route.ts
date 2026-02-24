import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { getDailyUserById, updateSubscription } from '@/lib/db/daily_user'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { subscription_status, trial_ends_at } = await request.json()

        const session = await getSessionFromCookies()
        if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        if (!session.isAdmin) return NextResponse.json({ error: 'Permissões insuficientes' }, { status: 403 })

        const targetUserId = parseInt(id)
        if (isNaN(targetUserId)) {
            return NextResponse.json({ error: 'ID de usuário inválido' }, { status: 400 })
        }

        await updateSubscription(targetUserId, {
            subscription_status,
            ...(trial_ends_at !== undefined ? { trial_ends_at } : {}),
        })

        return NextResponse.json({ message: 'Assinatura atualizada com sucesso' })
    } catch (error) {
        console.error('Erro ao atualizar assinatura:', error)
        return NextResponse.json({ error: 'Erro ao atualizar assinatura' }, { status: 500 })
    }
}
