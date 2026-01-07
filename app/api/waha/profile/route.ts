import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppProfileServer, WAHAProfile } from '@/lib/waha'
import { createRateLimiter } from '@/lib/middleware/rateLimit'
import { sanitizeString } from '@/lib/utils/sanitize'

const rateLimiter = createRateLimiter()

export async function POST(request: NextRequest) {
    try {
        // Rate limiting
        const rateLimitResult = await rateLimiter(request)
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                {
                    chatId: '',
                    error: 'Muitas requisições. Aguarde um momento antes de tentar novamente.',
                } as WAHAProfile,
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
                        'X-RateLimit-Limit': '100',
                        'X-RateLimit-Remaining': String(rateLimitResult.remaining),
                    },
                }
            )
        }

        const { phone } = await request.json()
        
        // Sanitizar input
        const sanitizedPhone = sanitizeString(phone?.toString() || '')

        if (!sanitizedPhone || sanitizedPhone.trim() === '') {
            return NextResponse.json({
                chatId: '',
                error: 'Telefone não pode estar vazio'
            } as WAHAProfile)
        }

        // Usa a função server-side do lib/waha.ts
        const profile = await getWhatsAppProfileServer(sanitizedPhone.trim())

        if (!profile) {
            return NextResponse.json({
                chatId: '',
                error: 'Erro ao buscar perfil do WhatsApp'
            } as WAHAProfile, { status: 500 })
        }

        return NextResponse.json(profile)

    } catch (error: unknown) {
        console.error('Erro ao buscar perfil do WhatsApp:', error)
        return NextResponse.json({
            chatId: '',
            error: error instanceof Error ? error.message : 'Erro ao buscar perfil'
        } as WAHAProfile, { status: 500 })
    }
}
