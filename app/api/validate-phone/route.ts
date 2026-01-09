import { NextRequest, NextResponse } from 'next/server'
import { validatePhoneWithWAHA } from '@/lib/waha'

/**
 * POST /api/validate-phone
 * Valida um número de telefone no WhatsApp via WAHA
 * Body: { phone: string }
 */
export async function POST(request: NextRequest) {
    try {
        const { phone } = await request.json()

        if (!phone) {
            return NextResponse.json(
                { error: 'Phone is required', isValid: false },
                { status: 400 }
            )
        }

        // Validar telefone com WAHA
        const result = await validatePhoneWithWAHA(phone)

        return NextResponse.json(result)
    } catch (error) {
        console.error('Error validating phone:', error)
        return NextResponse.json(
            {
                error: 'Validation failed',
                isValid: false,
                exists: false
            },
            { status: 500 }
        )
    }
}
