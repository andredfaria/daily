import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isUserAdmin, updateUserPassword } from '@/lib/supabase-admin'
import { createClient } from '@/lib/supabase-server'

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
      console.warn(`[SECURITY] Usuário não-admin ${authUser.id} tentou alterar senha`)
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar senhas de usuários' },
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

    // Obter nova senha do corpo da requisição
    const body = await request.json()
    const { password } = body

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Senha inválida' },
        { status: 400 }
      )
    }

    // Validar comprimento mínimo da senha
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 8 caracteres' },
        { status: 400 }
      )
    }

    // Buscar o daily_user para obter o auth_user_id
    const supabase = await createClient()
    const { data: dailyUser, error: dailyUserError } = await supabase
      .from('daily_user')
      .select('auth_user_id')
      .eq('id', targetUserId)
      .single()

    if (dailyUserError || !dailyUser) {
      return NextResponse.json(
        { error: 'Usuário não encontrado' },
        { status: 404 }
      )
    }

    if (!dailyUser.auth_user_id) {
      return NextResponse.json(
        { error: 'Este usuário não possui uma conta de autenticação vinculada' },
        { status: 400 }
      )
    }

    // Atualizar senha via Admin API
    await updateUserPassword(dailyUser.auth_user_id, password)

    // Log de auditoria (não registrar a senha)
    console.log(`[AUDIT] Admin ${authUser.email} (${authUser.id}) alterou a senha do usuário ${targetUserId} (auth: ${dailyUser.auth_user_id})`)

    return NextResponse.json({
      success: true,
      message: 'Senha atualizada com sucesso',
    })
  } catch (error: any) {
    console.error('Erro ao atualizar senha:', error)
    
    // Tratar erros específicos do Supabase
    let errorMessage = 'Erro ao atualizar senha'
    if (error.message?.includes('weak')) {
      errorMessage = 'A senha é muito fraca. Use uma senha mais forte.'
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    )
  }
}
