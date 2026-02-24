import { NextResponse } from 'next/server'
import { clearSessionCookie } from '@/lib/auth-jwt'

export async function POST() {
  try {
    await clearSessionCookie()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Erro ao fazer logout' },
      { status: 500 }
    )
  }
}
