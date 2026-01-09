import { createAdminClient } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params
        const { subscription_status, trial_ends_at } = await request.json()

        // Verificar se quem está chamando é admin
        const supabase = await createClient()
        const { data: { user } } = await supabase.auth.getUser()

        if (!user) {
            return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
        }

        // Usar Admin Client para verificar permissão do autor
        const adminClient = createAdminClient()
        const { data: authorUser, error: authorError } = await adminClient
            .from('daily_user')
            .select('is_admin')
            .eq('auth_user_id', user.id)
            .single()

        if (authorError || !authorUser?.is_admin) {
            return NextResponse.json({ error: 'Permissões insuficientes' }, { status: 403 })
        }

        // Atualizar daily_user alvo
        const { error: updateError } = await adminClient
            .from('daily_user')
            .update({
                subscription_status,
                trial_ends_at: trial_ends_at || null,
            })
            .eq('id', parseInt(id))

        if (updateError) {
            throw updateError
        }

        return NextResponse.json({ message: 'Assinatura atualizada com sucesso' })
    } catch (error) {
        console.error('Erro ao atualizar assinatura:', error)
        return NextResponse.json({ error: 'Erro ao atualizar assinatura' }, { status: 500 })
    }
}
