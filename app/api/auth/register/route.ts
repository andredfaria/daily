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
    // emailRedirectTo: null desabilita o envio de email de confirmação
    // A confirmação será feita automaticamente via Admin API
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: undefined, // Desabilita envio de email de confirmação
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
    // IMPORTANTE: A confirmação deve ser feita ANTES de criar o daily_user
    let emailConfirmed = false
    try {
      const { error: confirmError } = await adminClient.auth.admin.updateUserById(
        data.user.id,
        { email_confirm: true }
      )

      if (confirmError) {
        console.error('⚠️ Erro ao confirmar email:', confirmError)
        // Se a confirmação falhar, retornar erro pois é crítica para o fluxo
        return NextResponse.json(
          { error: 'Erro ao confirmar email. Tente novamente.' },
          { status: 500 }
        )
      }

      // Verificar se a confirmação foi bem-sucedida
      const { data: updatedUser, error: getUserError } = await adminClient.auth.admin.getUserById(data.user.id)
      
      if (getUserError) {
        console.error('⚠️ Erro ao verificar confirmação de email:', getUserError)
        return NextResponse.json(
          { error: 'Erro ao verificar confirmação de email. Tente novamente.' },
          { status: 500 }
        )
      }

      if (updatedUser?.user?.email_confirmed_at) {
        emailConfirmed = true
        console.log('✅ Email confirmado automaticamente:', {
          email_confirmed_at: updatedUser.user.email_confirmed_at,
        })
      } else {
        console.error('⚠️ Email não foi confirmado - email_confirmed_at está null')
        return NextResponse.json(
          { error: 'Falha na confirmação automática de email. Tente novamente.' },
          { status: 500 }
        )
      }
    } catch (err) {
      console.error('⚠️ Erro no processo de confirmação de email:', err)
      return NextResponse.json(
        { error: 'Erro ao processar confirmação de email. Tente novamente.' },
        { status: 500 }
      )
    }

    let dailyUser = null
    try {
      // Tentar garantir vinculação usando a função ensureDailyUserLink
      // Esta função cria o daily_user se não existir
      const { ensureDailyUserLink } = await import('@/lib/supabase-admin')
      try {
        dailyUser = await ensureDailyUserLink(data.user.id, {
          name: name || email.split('@')[0],
          phone: phone || null,
        })
        console.log('✅ daily_user garantido/criado com sucesso')
      } catch (linkError) {
        console.error('[REGISTER] Erro ao garantir vinculação via ensureDailyUserLink:', linkError)
        
        // Fallback: tentar criar diretamente via upsert
        try {
          const { data: createdDailyUser, error: dbError } = await adminClient
            .from('daily_user')
            .upsert({
              auth_user_id: data.user.id,
              name: name || email.split('@')[0],
              phone: phone || null,
            }, {
              onConflict: 'auth_user_id',
              ignoreDuplicates: false
            })
            .select()
            .single()

          if (dbError) {
            console.error('[REGISTER] Erro ao criar daily_user via upsert:', dbError)
            // Não retornamos erro para o usuário pois o Auth foi criado
            // O usuário poderá completar o cadastro depois ou o suporte resolver
          } else {
            dailyUser = createdDailyUser
            console.log('✅ daily_user criado via upsert com sucesso')
          }
        } catch (upsertError) {
          console.error('[REGISTER] Erro no processo de criação do daily_user via upsert:', upsertError)
          // Não falha o registro, mas loga o erro para debug
        }
      }
    } catch (err) {
      console.error('[REGISTER] Erro geral no processo de criação do daily_user:', err)
      // Não falha o registro, mas loga o erro
    }

    // Enviar webhook após criação do usuário (se configurado)
    const webhookUrl = process.env.USER_CREATED_WEBHOOK_URL
    if (webhookUrl && dailyUser) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'DailySync/1.0',
          },
          body: JSON.stringify({
            event: 'user.created',
            timestamp: new Date().toISOString(),
            user: {
              id: data.user.id,
              email: data.user.email,
              name: name || email.split('@')[0],
              phone: phone || null,
              daily_user_id: dailyUser.id,
              created_at: new Date().toISOString(),
              subscription_status: 'trial',
              trial_ends_at: dailyUser.trial_ends_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              is_admin: false,
            },
          }),
        })
        console.log('✅ Webhook enviado com sucesso')
      } catch (webhookError) {
        // Log error mas não falha o cadastro
        console.error('⚠️ Erro ao enviar webhook:', webhookError)
      }
    }

    // Fazer login automático após cadastro e confirmação de email
    // IMPORTANTE: Só tentar login se o email foi confirmado com sucesso
    if (!emailConfirmed) {
      console.error('⚠️ Tentativa de login sem confirmação de email')
      return NextResponse.json(
        { error: 'Email não confirmado. Tente novamente.' },
        { status: 500 }
      )
    }

    let session = null
    try {
      console.log('🔄 Tentando login automático após cadastro...')
      const { data: sessionData, error: sessionError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (sessionError) {
        console.error('⚠️ Erro ao fazer login automático:', sessionError)
        // Retorna sucesso mas sem sessão - usuário precisa fazer login manual
        // Isso pode acontecer se houver algum delay na propagação da confirmação
        return NextResponse.json({
          user: data.user,
          message: 'Usuário criado e confirmado com sucesso. Faça login para continuar.',
          requiresLogin: true,
          emailConfirmed: true,
        })
      }

      if (!sessionData?.session) {
        console.error('⚠️ Login automático retornou sem sessão')
        return NextResponse.json({
          user: data.user,
          message: 'Usuário criado e confirmado com sucesso. Faça login para continuar.',
          requiresLogin: true,
          emailConfirmed: true,
        })
      }

      session = sessionData.session
      console.log('✅ Login automático realizado com sucesso', {
        user_id: session.user.id,
        expires_at: session.expires_at,
      })
    } catch (loginError) {
      console.error('⚠️ Erro no processo de login automático:', loginError)
      // Retorna sucesso mas sem sessão - usuário precisa fazer login manual
      return NextResponse.json({
        user: data.user,
        message: 'Usuário criado e confirmado com sucesso. Faça login para continuar.',
        requiresLogin: true,
        emailConfirmed: true,
      })
    }

    // Retornar sessão para o frontend fazer o redirecionamento
    return NextResponse.json({
      user: data.user,
      session: session,
      message: 'Conta criada com sucesso!',
      requiresLogin: false,
      emailConfirmed: true,
      dailyUser: dailyUser,
    })
  } catch (err) {
    console.error('Erro no registro:', err)
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}
