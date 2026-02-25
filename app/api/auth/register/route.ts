import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getDailyUserByEmail, getDailyUserByPhone, createDailyUser } from '@/lib/db/daily_user'
import { signToken, setSessionCookie } from '@/lib/auth-jwt'
import { validatePhoneWithWAHAServer } from '@/lib/waha'
import { normalizePhoneForDB } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
    const { email, password, name, phone } = await request.json()

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'Telefone e senha são obrigatórios' },
        { status: 400 }
      )
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'A senha deve ter no mínimo 6 caracteres' },
        { status: 400 }
      )
    }

    // Validar o número com a API do Waha antes de criar o usuário
    const wahaResult = await validatePhoneWithWAHAServer(phone.trim())
    if (!wahaResult.isValid || !wahaResult.exists) {
      return NextResponse.json(
        { error: wahaResult.error || 'Número não encontrado no WhatsApp. Verifique se o número está correto.' },
        { status: 400 }
      )
    }

    // Usar o chatId retornado pelo Waha (ex: "5511999999999@c.us")
    // Fallback: normalizar o número caso o Waha não retorne chatId
    const phoneToSave = wahaResult.chatId || normalizePhoneForDB(phone.trim())

    // Verificar se phone já existe no banco
    const existingByPhone = await getDailyUserByPhone(phoneToSave)
    if (existingByPhone) {
      return NextResponse.json(
        { error: 'Este telefone já está cadastrado' },
        { status: 400 }
      )
    }

    // Verificar se email já existe (se fornecido)
    if (email) {
      const existingByEmail = await getDailyUserByEmail(email)
      if (existingByEmail) {
        return NextResponse.json(
          { error: 'Este email já está cadastrado' },
          { status: 400 }
        )
      }
    }

    // Hash da senha
    const password_hash = await bcrypt.hash(password, 12)

    // Criar usuário no MySQL com o chatId normalizado
    const user = await createDailyUser({
      name: name || phone,
      email: email || null,
      password_hash,
      phone: phoneToSave,
      is_admin: false,
      subscription_status: 'trial',
    })

    // Enviar webhook após criação (se configurado)
    const webhookUrl = process.env.USER_CREATED_WEBHOOK_URL
    if (webhookUrl) {
      try {
        await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'DailySync/1.0' },
          body: JSON.stringify({
            event: 'user.created',
            timestamp: new Date().toISOString(),
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              phone: user.phone,
              subscription_status: 'trial',
              trial_ends_at: user.trial_ends_at,
              is_admin: false,
            },
          }),
        })
      } catch (err) {
        console.error('[REGISTER] Erro ao enviar webhook:', err)
      }
    }

    // Login automático após cadastro
    const token = await signToken({
      userId: user.id,
      phone: user.phone!,
      email: user.email || undefined,
      isAdmin: false,
    })

    await setSessionCookie(token)

    return NextResponse.json({
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        is_admin: user.is_admin,
        subscription_status: user.subscription_status,
        trial_ends_at: user.trial_ends_at,
      },
      message: 'Conta criada com sucesso!',
      requiresLogin: false,
    })
  } catch (err) {
    console.error('[REGISTER] Erro:', err)
    return NextResponse.json(
      { error: 'Erro ao criar usuário' },
      { status: 500 }
    )
  }
}
