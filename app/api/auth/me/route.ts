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
    const { data: dailyUser, error } = await supabase
      .from('daily_user')
      .select('*')
      .eq('auth_user_id', user.id)
      .single()

    if (error) {
      console.error('Erro ao buscar daily_user:', error)
    }

    return NextResponse.json({
      user,
      dailyUser: dailyUser || null,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro ao buscar usuário' },
      { status: 500 }
    )
  }
}
