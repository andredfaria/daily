import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isUserAdmin, updateUserAdminStatus } from '@/lib/supabase-admin'

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
      console.warn(`[SECURITY] Usuário não-admin ${authUser.id} tentou alterar permissões`)
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar permissões' },
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

    // Obter novo status do corpo da requisição
    const body = await request.json()
    const { is_admin } = body

    if (typeof is_admin !== 'boolean') {
      return NextResponse.json(
        { error: 'Valor de is_admin inválido. Deve ser boolean.' },
        { status: 400 }
      )
    }

    // Atualizar status de admin
    const updatedUser = await updateUserAdminStatus(targetUserId, is_admin)

    // Log de auditoria
    console.log(`[AUDIT] Admin ${authUser.email} (${authUser.id}) alterou is_admin do usuário ${targetUserId} para ${is_admin}`)

    return NextResponse.json({
      success: true,
      message: `Usuário ${is_admin ? 'promovido a' : 'removido de'} administrador com sucesso`,
      user: updatedUser,
    })
  } catch (error: any) {
    console.error('Erro ao atualizar permissões:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao atualizar permissões' },
      { status: 500 }
    )
  }
}
