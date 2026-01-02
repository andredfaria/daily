import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isUserAdmin, linkAuthUser } from '@/lib/supabase-admin'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
      console.warn(`[SECURITY] Usuário não-admin ${authUser.id} tentou vincular auth_user`)
      return NextResponse.json(
        { error: 'Apenas administradores podem vincular usuários de autenticação' },
        { status: 403 }
      )
    }

    // Validar ID do usuário alvo
    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) {
      return NextResponse.json(
        { error: 'ID de usuário inválido' },
        { status: 400 }
      )
    }

    // Obter auth_user_id do corpo da requisição
    const body = await request.json()
    const { auth_user_id } = body

    // Validar que auth_user_id é string ou null
    if (auth_user_id !== null && typeof auth_user_id !== 'string') {
      return NextResponse.json(
        { error: 'auth_user_id deve ser uma string (UUID) ou null' },
        { status: 400 }
      )
    }

    // Vincular ou desvincular
    const updatedUser = await linkAuthUser(targetUserId, auth_user_id)

    // Log de auditoria
    const action = auth_user_id ? 'vinculou' : 'desvinculou'
    console.log(`[AUDIT] Admin ${authUser.email} (${authUser.id}) ${action} auth_user_id ${auth_user_id || 'null'} ao usuário ${targetUserId}`)

    return NextResponse.json({
      success: true,
      message: auth_user_id
        ? 'Usuário de autenticação vinculado com sucesso'
        : 'Usuário de autenticação desvinculado com sucesso',
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Erro ao vincular usuário de autenticação:', error)
    
    // Tratar erros específicos
    let errorMessage = 'Erro ao vincular usuário de autenticação'
    if (error.message.includes('não encontrado')) {
      errorMessage = error.message
    } else if (error.message.includes('já está vinculado')) {
      errorMessage = error.message
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    )
  }
}
