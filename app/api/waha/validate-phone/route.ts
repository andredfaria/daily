import { NextRequest, NextResponse } from 'next/server'
import { validatePhoneWithWAHAServer, WAHAValidationResult } from '@/lib/waha'

export async function POST(request: NextRequest) {
    try {
        const { phone } = await request.json()

        if (!phone || phone.trim() === '') {
            return NextResponse.json({
                isValid: false,
                exists: false,
                error: 'Telefone não pode estar vazio'
            } as WAHAValidationResult)
        }

        // Usa a função server-side do lib/waha.ts
        const result = await validatePhoneWithWAHAServer(phone.trim())

        return NextResponse.json(result)

    } catch (error: any) {
        console.error('Erro ao validar telefone com WAHA:', error)
        return NextResponse.json({
            isValid: false,
            exists: false,
            error: error.message || 'Erro de conexão ao validar telefone'
        } as WAHAValidationResult, { status: 500 })
    }
}
