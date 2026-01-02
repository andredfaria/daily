import { createClient, getUser } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Obter usuário autenticado
    const authUser = await getUser()

    if (!authUser) {
      return NextResponse.json(
        { error: 'Não autenticado', authorized: false },
        { status: 401 }
      )
    }

    // Validar ID do usuário a ser editado
    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) {
      return NextResponse.json(
        { error: 'ID de usuário inválido', authorized: false },
        { status: 400 }
      )
    }

    // Buscar daily_user do usuário autenticado
    const supabase = await createClient()
    const { data: currentDailyUser, error: currentUserError } = await supabase
      .from('daily_user')
      .select('id, is_admin')
      .eq('auth_user_id', authUser.id)
      .single()

    if (currentUserError || !currentDailyUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado no sistema', authorized: false },
        { status: 404 }
      )
    }

    // Verificar permissões
    // Admin pode editar qualquer usuário
    if (currentDailyUser.is_admin) {
      return NextResponse.json({
        authorized: true,
        reason: 'admin',
      })
    }

    // Não-admin só pode editar seus próprios dados
    if (currentDailyUser.id === targetUserId) {
      return NextResponse.json({
        authorized: true,
        reason: 'own_data',
      })
    }

    // Não autorizado
    return NextResponse.json(
      {
        error: 'Você não tem permissão para editar este usuário',
        authorized: false,
      },
      { status: 403 }
    )
  } catch (error: any) {
    console.error('Erro ao validar permissões de edição:', error)
    return NextResponse.json(
      { error: 'Erro ao validar permissões', authorized: false },
      { status: 500 }
    )
  }
}
