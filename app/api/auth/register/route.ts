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

    console.log('📝 Criando usuário...')

    // Criar usuário com signUp
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
      console.error('❌ Erro ao criar usuário:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      )
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Erro ao criar usuário' },
        { status: 500 }
      )
    }

    console.log('✅ Usuário criado:', {
      id: data.user.id,
      email: data.user.email,
      email_confirmed_at: data.user.email_confirmed_at,
    })

    // Usar Admin Client para confirmar email automaticamente e criar daily_user
    const { createAdminClient } = await import('@/lib/supabase-admin')
    const adminClient = createAdminClient()

    // Auto-confirmar email usando Admin API
    try {
      const { error: confirmError } = await adminClient.auth.admin.updateUserById(
        data.user.id,
        { email_confirm: true }
      )

      if (confirmError) {
        console.error('⚠️ Erro ao confirmar email:', confirmError)
      } else {
        console.log('✅ Email confirmado automaticamente')
      }
    } catch (err) {
      console.error('⚠️ Erro no processo de confirmação de email:', err)
    }

    try {
      // O trigger set_trial_period() automaticamente configura:
      // - trial_ends_at (7 dias a partir de agora)
      // - subscription_status ('trial')
      // - is_admin (false)
      const { error: dbError } = await adminClient
        .from('daily_user')
        .upsert({
          auth_user_id: data.user.id,
          name: name || email.split('@')[0],
          phone: phone || null,
        }, {
          onConflict: 'auth_user_id',
          ignoreDuplicates: false
        })

      if (dbError) {
        console.error('Erro ao criar daily_user:', dbError)
        // Não retornamos erro para o usuário pois o Auth foi criado
        // O usuário poderá completar o cadastro depois ou o suporte resolver
      } else {
        console.log('✅ daily_user criado com sucesso')
      }
    } catch (err) {
      console.error('Erro no processo de criação do daily_user:', err)
    }

    return NextResponse.json({
      user: data.user,
      message: 'Usuário criado e confirmado com sucesso. Faça login para continuar.',
      requiresLogin: true,
      emailConfirmed: true,
    })
  } catch (err) {
    console.error('Erro no registro:', err)
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}
