import { NextRequest, NextResponse } from 'next/server'
import { getUser } from '@/lib/supabase-server'
import { isUserAdmin, updateUserEmail } from '@/lib/supabase-admin'
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
      console.warn(`[SECURITY] Usuário não-admin ${authUser.id} tentou alterar email`)
      return NextResponse.json(
        { error: 'Apenas administradores podem alterar emails de usuários' },
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

    // Obter novo email do corpo da requisição
    const body = await request.json()
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email inválido' },
        { status: 400 }
      )
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Formato de email inválido' },
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

    // Atualizar email via Admin API
    await updateUserEmail(dailyUser.auth_user_id, email)

    // Log de auditoria
    console.log(`[AUDIT] Admin ${authUser.email} (${authUser.id}) alterou o email do usuário ${targetUserId} (auth: ${dailyUser.auth_user_id}) para ${email}`)

    return NextResponse.json({
      success: true,
      message: 'Email atualizado com sucesso',
      new_email: email,
    })
  } catch (error: any) {
    console.error('Erro ao atualizar email:', error)
    
    // Tratar erros específicos do Supabase
    let errorMessage = 'Erro ao atualizar email'
    if (error.message?.includes('already been registered')) {
      errorMessage = 'Este email já está em uso por outro usuário'
    } else if (error.message?.includes('invalid')) {
      errorMessage = 'Email inválido'
    }

    return NextResponse.json(
      { error: errorMessage },
      { status: 400 }
    )
  }
}
