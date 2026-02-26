import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { 
  getDailyUserById, 
  updateDailyUser, 
  updateAdminStatus, 
  updateUserEmail, 
  updateUserPassword,
  deleteDailyUser
} from '@/lib/db/daily_user'
import { isValidEmail } from '@/lib/validations'
import bcrypt from 'bcryptjs'

/**
 * Route Handler consolidado para operações administrativas sobre um usuário específico.
 * Substitui múltiplos endpoints (update-email, update-password, update-role, etc.)
 */

// GET - Buscar detalhes de um usuário específico
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const userId = parseInt(params.id)
    const user = await getDailyUserById(userId)

    if (!user) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    return NextResponse.json(user)
  } catch {
    return NextResponse.json({ error: 'Erro ao buscar usuário' }, { status: 500 })
  }
}

// PATCH - Atualização parcial (campos variados, email, senha, cargo, assinatura)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const targetUserId = parseInt(params.id)
    if (isNaN(targetUserId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json()
    const { email, password, is_admin, subscription, ...otherData } = body

    // 1. Atualizar Email se fornecido
    if (email !== undefined) {
      if (!isValidEmail(email)) {
        return NextResponse.json({ error: 'Formato de email inválido' }, { status: 400 })
      }
      await updateUserEmail(targetUserId, email)
    }

    // 2. Atualizar Senha se fornecida
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6) {
        return NextResponse.json({ error: 'Senha deve ter no mínimo 6 caracteres' }, { status: 400 })
      }
      const salt = await bcrypt.genSalt(10)
      const hashedPassword = await bcrypt.hash(password, salt)
      await updateUserPassword(targetUserId, hashedPassword)
    }

    // 3. Atualizar Cargo (Admin Status)
    if (is_admin !== undefined) {
      if (typeof is_admin !== 'boolean') {
        return NextResponse.json({ error: 'is_admin deve ser boolean' }, { status: 400 })
      }
      await updateAdminStatus(targetUserId, is_admin)
    }

    // 4. Atualizar Assinatura ou outros campos genéricos
    const updatePayload: Record<string, unknown> = { ...otherData }
    if (subscription) {
       Object.assign(updatePayload, subscription)
    }

    if (Object.keys(updatePayload).length > 0) {
      await updateDailyUser(targetUserId, updatePayload)
    }

    console.log(`[AUDIT] Admin ${session.userId} atualizou usuário ${targetUserId}`)

    return NextResponse.json({ success: true, message: 'Usuário atualizado com sucesso' })
  } catch (error: unknown) {
    console.error('Erro no PATCH de usuário:', error)
    const message = error instanceof Error ? error.message : 'Erro ao atualizar usuário'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE - Remover usuário
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSessionFromCookies()
    if (!session || !session.isAdmin) {
      return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
    }

    const targetUserId = parseInt(params.id)
    await deleteDailyUser(targetUserId)

    console.log(`[AUDIT] Admin ${session.userId} removeu usuário ${targetUserId}`)

    return NextResponse.json({ success: true, message: 'Usuário removido com sucesso' })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Erro ao remover usuário'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
