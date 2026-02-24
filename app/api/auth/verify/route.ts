import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getUserByResetToken, updateUserPassword, clearResetToken } from '@/lib/db/daily_user'
import { signToken, setSessionCookie } from '@/lib/auth-jwt'

// POST /api/auth/verify — redefinir senha com token
export async function POST(request: NextRequest) {
    try {
        const body = await request.json()
        const { token, password } = body

        if (!token || !password) {
            return NextResponse.json(
                { error: 'Token e nova senha são obrigatórios' },
                { status: 400 }
            )
        }

        if (password.length < 6) {
            return NextResponse.json(
                { error: 'A senha deve ter no mínimo 6 caracteres' },
                { status: 400 }
            )
        }

        // Buscar usuário pelo token
        const user = await getUserByResetToken(token)

        if (!user) {
            return NextResponse.json(
                { error: 'Token inválido ou expirado' },
                { status: 400 }
            )
        }

        // Atualizar senha
        const passwordHash = await bcrypt.hash(password, 12)
        await updateUserPassword(user.id, passwordHash)
        await clearResetToken(user.id)

        // Login automático após reset
        const jwtToken = await signToken({
            userId: user.id,
            email: user.email!,
            isAdmin: Boolean(user.is_admin),
        })
        await setSessionCookie(jwtToken)

        return NextResponse.json({
            message: 'Senha redefinida com sucesso',
            user: { id: user.id, email: user.email },
        })
    } catch (err) {
        console.error('[VERIFY/RESET] Erro:', err)
        return NextResponse.json(
            { error: 'Erro ao redefinir senha' },
            { status: 500 }
        )
    }
}
