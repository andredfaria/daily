import { NextRequest, NextResponse } from 'next/server'
import { validatePhoneWithWAHAServer, WAHAValidationResult } from '@/lib/waha'
import { createStrictRateLimiter } from '@/lib/middleware/rateLimit'
import { sanitizeString } from '@/lib/utils/sanitize'

const rateLimiter = createStrictRateLimiter()

export async function POST(request: NextRequest) {
    try {
        // Rate limiting para endpoint sensível
        const rateLimitResult = await rateLimiter(request)
        if (!rateLimitResult.allowed) {
            return NextResponse.json(
                {
                    isValid: false,
                    exists: false,
                    error: 'Muitas requisições. Aguarde um momento antes de tentar novamente.',
                } as WAHAValidationResult,
                {
                    status: 429,
                    headers: {
                        'Retry-After': String(Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000)),
                        'X-RateLimit-Limit': '10',
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
                isValid: false,
                exists: false,
                error: 'Telefone não pode estar vazio'
            } as WAHAValidationResult)
        }

        // Usa a função server-side do lib/waha.ts
        const result = await validatePhoneWithWAHAServer(sanitizedPhone.trim())

        return NextResponse.json(result)

    } catch (error: unknown) {
        console.error('Erro ao validar telefone com WAHA:', error)
        return NextResponse.json({
            isValid: false,
            exists: false,
            error: error instanceof Error ? error.message : 'Erro de conexão ao validar telefone'
        } as WAHAValidationResult, { status: 500 })
    }
}
