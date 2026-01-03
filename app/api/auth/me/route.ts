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
    const { data: dailyUser, error: fetchError } = await supabase
      .from('daily_user')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (fetchError) {
      console.error('Erro ao buscar daily_user:', fetchError)
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
