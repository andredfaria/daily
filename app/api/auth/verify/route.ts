import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { token, type } = await request.json()

        if (!token || !type) {
            return NextResponse.json(
                { error: 'Token e tipo são obrigatórios' },
                { status: 400 }
            )
        }

        const supabase = await createClient()

        console.log('🔍 Verificando email com token...')

        // Verificar o token usando o método verifyOtp
        const { data, error } = await supabase.auth.verifyOtp({
            token_hash: token,
            type: type as 'signup' | 'email',
        })

        if (error) {
            console.error('❌ Erro ao verificar email:', error)
            return NextResponse.json(
                { error: error.message || 'Erro ao verificar email' },
                { status: 400 }
            )
        }

        if (!data.user) {
            return NextResponse.json(
                { error: 'Usuário não encontrado' },
                { status: 404 }
            )
        }

        console.log('✅ Email verificado com sucesso:', {
            id: data.user.id,
            email: data.user.email,
            email_confirmed_at: data.user.email_confirmed_at,
        })

        return NextResponse.json({
            message: 'Email verificado com sucesso',
            user: {
                id: data.user.id,
                email: data.user.email,
                email_confirmed_at: data.user.email_confirmed_at,
            },
        })
    } catch (err) {
        console.error('❌ Erro no processo de verificação:', err)
        return NextResponse.json(
            { error: 'Erro ao verificar email' },
            { status: 500 }
        )
    }
}
