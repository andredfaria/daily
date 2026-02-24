import { NextRequest, NextResponse } from 'next/server'
import { getSessionFromCookies } from '@/lib/auth-jwt'
import { listDailyUsers } from '@/lib/db/daily_user'

// Este endpoint é simplificado. Como não há mais Supabase Auth separado,
// listamos os usuários do MySQL diretamente com seu status de vinculação.
export async function GET() {
  try {
    const session = await getSessionFromCookies()
    if (!session) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    if (!session.isAdmin) return NextResponse.json({ error: 'Apenas administradores' }, { status: 403 })

    const { data: users } = await listDailyUsers({ limit: 1000 })

    const formattedUsers = users.map(u => ({
      id: u.id,
      email: u.email,
      name: u.name,
      created_at: u.created_at,
      is_admin: u.is_admin,
      subscription_status: u.subscription_status,
      has_password: true, // todos os usuários neste sistema têm senha direta
    }))

    return NextResponse.json({
      success: true,
      users: formattedUsers,
      total: formattedUsers.length,
    })
  } catch {
    console.error('Erro ao listar usuários')
    return NextResponse.json({ error: 'Erro ao listar usuários' }, { status: 500 })
  }
}
