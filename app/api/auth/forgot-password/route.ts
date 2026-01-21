import { createClient } from '@/lib/supabase-server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email é obrigatório' },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // Gerar URL de redirecionamento após reset
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const redirectTo = `${origin}/reset-password`

    // Enviar email de reset de senha
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    })

    if (error) {
      console.error('Erro ao enviar email de reset:', error)
      // Por segurança, retornar sucesso mesmo se email não existir
      return NextResponse.json({
        message: 'Se o email existir, você receberá um link para redefinir sua senha.',
      })
    }

    return NextResponse.json({
      message: 'Se o email existir, você receberá um link para redefinir sua senha.',
    })
  } catch (err) {
    console.error('Erro no reset de senha:', err)
    return NextResponse.json(
      { error: 'Erro ao processar solicitação' },
      { status: 500 }
    )
  }
}
