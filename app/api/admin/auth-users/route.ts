import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isUserAdmin, listAuthUsers } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    // Verificar autenticação
    const authUser = await getUser()
    if (!authUser) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401 }
      )
    }

    // Verificar se o usuário autenticado é admin
    const isAdmin = await isUserAdmin(authUser.id)
    if (!isAdmin) {
      console.warn(`[SECURITY] Usuário não-admin ${authUser.id} tentou listar auth users`)
      return NextResponse.json(
        { error: 'Apenas administradores podem listar usuários de autenticação' },
        { status: 403 }
      )
    }

    // Listar todos os auth users
    const authUsers = await listAuthUsers()

    // Buscar quais auth_user_id já estão vinculados
    const supabase = await createClient()
    const { data: linkedUsers } = await supabase
      .from('daily_user')
      .select('auth_user_id')
      .not('auth_user_id', 'is', null)

    const linkedAuthIds = new Set(linkedUsers?.map(u => u.auth_user_id) || [])

    // Formatar resposta com informações úteis
    const formattedUsers = authUsers.map(user => ({
      id: user.id,
      email: user.email,
      created_at: user.created_at,
      is_linked: linkedAuthIds.has(user.id),
      email_confirmed_at: user.email_confirmed_at,
      last_sign_in_at: user.last_sign_in_at,
    }))

    // Ordenar: não vinculados primeiro, depois por email
    formattedUsers.sort((a, b) => {
      if (a.is_linked !== b.is_linked) {
        return a.is_linked ? 1 : -1
      }
      return (a.email || '').localeCompare(b.email || '')
    })

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
      available: formattedUsers.filter(u => !u.is_linked).length,
    })
  } catch (error: any) {
    console.error('Erro ao listar usuários de autenticação:', error)
    return NextResponse.json(
      { error: 'Erro ao listar usuários de autenticação' },
      { status: 500 }
    )
  }
}
