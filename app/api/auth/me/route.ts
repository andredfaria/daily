import { createClient, getUser } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const user = await getUser()

    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Buscar dados do daily_user associado
    const supabase = await createClient()
    let dailyUser = null
    
    try {
      const { data: userData, error: fetchError } = await supabase
        .from('daily_user')
        .select('*')
        .eq('auth_user_id', user.id)
        .single()

      if (!fetchError && userData) {
        dailyUser = userData
      } else {
        // Se não encontrou daily_user, garantir vinculação
        console.log('[AUTH/ME] daily_user não encontrado, garantindo vinculação...')
        const { ensureDailyUserLink } = await import('@/lib/supabase-admin')
        try {
          dailyUser = await ensureDailyUserLink(user.id, user.user_metadata)
          console.log('[AUTH/ME] daily_user criado/vinculado com sucesso')
        } catch (linkError) {
          console.error('[AUTH/ME] Erro ao garantir vinculação:', linkError)
          // Retorna erro apenas se falhar completamente
          return NextResponse.json(
            { error: 'Erro ao garantir vinculação do usuário' },
            { status: 500 }
          )
        }
      }
    } catch (err) {
      console.error('[AUTH/ME] Erro ao buscar daily_user:', err)
      // Tenta garantir vinculação como fallback
      try {
        const { ensureDailyUserLink } = await import('@/lib/supabase-admin')
        dailyUser = await ensureDailyUserLink(user.id, user.user_metadata)
      } catch (linkError) {
        console.error('[AUTH/ME] Erro ao garantir vinculação no fallback:', linkError)
      }
    }

    return NextResponse.json({
      user,
      dailyUser: dailyUser || null,
    })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao buscar usuário' },
      { status: 500 }
    )
  }
}
