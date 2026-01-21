import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json()

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email e senha são obrigatórios' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      return NextResponse.json(
        { error: error.message },
        { status: 401 }
      )
    }

    // Buscar informações do daily_user para redirecionamento inteligente
    let dailyUser = null
    if (data.user) {
      try {
        const { data: userData, error: userError } = await supabase
          .from('daily_user')
          .select('id, is_admin, subscription_status, trial_ends_at, subscription_ends_at')
          .eq('auth_user_id', data.user.id)
          .single()

        if (!userError && userData) {
          dailyUser = userData
        } else {
          // Se não encontrou daily_user, garantir vinculação
          console.log('[LOGIN] daily_user não encontrado, garantindo vinculação...')
          const { ensureDailyUserLink } = await import('@/lib/supabase-admin')
          try {
            const createdDailyUser = await ensureDailyUserLink(data.user.id, data.user.user_metadata)
            dailyUser = {
              id: createdDailyUser.id,
              is_admin: createdDailyUser.is_admin,
              subscription_status: createdDailyUser.subscription_status,
              trial_ends_at: createdDailyUser.trial_ends_at,
              subscription_ends_at: createdDailyUser.subscription_ends_at,
            }
            console.log('[LOGIN] daily_user criado/vinculado com sucesso')
          } catch (linkError) {
            console.error('[LOGIN] Erro ao garantir vinculação:', linkError)
            // Não falha o login, mas loga o erro
          }
        }
      } catch (err) {
        // Log mas não falha o login
        console.error('[LOGIN] Erro ao buscar daily_user:', err)
      }
    }

    return NextResponse.json({
      user: data.user,
      session: data.session,
      dailyUser: dailyUser,
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao fazer login' },
      { status: 500 }
    )
  }
}
