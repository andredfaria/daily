import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Criar usuário na autenticação do Supabase
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
          phone: phone || null,
        },
      },
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    // Garantir que o daily_user seja criado/atualizado com status de trial
    if (data.user) {
      try {
        const { createAdminClient } = await import('@/lib/supabase-admin')
        const adminClient = createAdminClient()

        // Calcular data de fim do trial (7 dias)
        const trialEndsAt = new Date()
        trialEndsAt.setDate(trialEndsAt.getDate() + 7)

        const { error: dbError } = await adminClient
          .from('daily_user')
          .upsert({
            auth_user_id: data.user.id,
            name: name || email.split('@')[0],
            phone: phone || null, // Nota: telefone único pode causar erro se já existir
            subscription_status: 'trial',
            trial_ends_at: trialEndsAt.toISOString(),
          }, {
            onConflict: 'auth_user_id',
            ignoreDuplicates: false
          })

        if (dbError) {
          console.error('Erro ao criar daily_user:', dbError)
          // Não retornamos erro para o usuário pois o Auth foi criado
          // O usuário poderá completar o cadastro depois ou o suporte resolver
        }
      } catch (err) {
        console.error('Erro no processo de criação do daily_user:', err)
      }
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      message: 'Usuário criado com sucesso',
    })
  } catch (err) {
    console.error('Erro no registro:', err)
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}
