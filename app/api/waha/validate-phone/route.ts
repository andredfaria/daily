import { NextRequest, NextResponse } from 'next/server'

export interface WAHAValidationResult {
    isValid: boolean
    exists: boolean
    validatedPhone?: string
    chatId?: string
    error?: string
}

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

        const wahaUrl = process.env.WAHA_BASE_URL || ''
        const wahaApiKey = process.env.WAHA_API_KEY || ''

        if (!wahaUrl) {
            return NextResponse.json({
                isValid: false,
                exists: false,
                error: 'URL do WAHA não configurada no servidor'
            } as WAHAValidationResult)
        }

        const normalizedPhone = phone.trim()
        const endpoint = `${wahaUrl.replace(/\/$/, '')}/api/contacts/check-exists?phone=${normalizedPhone.replace(/\D/g, '')}&session=default`

        const response = await fetch(endpoint, {
            method: 'GET',
            headers: {
                'accept': 'application/json',
                ...(wahaApiKey && { 'X-Api-Key': wahaApiKey }),
            },
        })

        if (!response.ok) {
            const errorText = await response.text()
            let errorMessage = `Erro ao validar telefone: ${response.status} ${errorText || response.statusText}`

            if (normalizedPhone.includes('55') || normalizedPhone.startsWith('+55')) {
                errorMessage += '. Dica: números brasileiros geralmente precisam do "9" no início do número (ex: +55 11 99999-9999)'
            }

            return NextResponse.json({
                isValid: false,
                exists: false,
                error: errorMessage
            } as WAHAValidationResult)
        }

        const data = await response.json()
        const exists = data.numberExists === true
        const chatId = data.chatId || null

        let validatedPhone: string | undefined = undefined
        if (chatId && typeof chatId === 'string') {
            validatedPhone = chatId.split('@')[0]
        }

        return NextResponse.json({
            isValid: true,
            exists: exists,
            validatedPhone: exists ? validatedPhone : undefined,
            chatId: exists ? chatId : undefined,
            error: exists ? undefined : 'Número não encontrado no WhatsApp. Verifique se o número está correto. Dica: números brasileiros geralmente precisam do "9" no início (ex: +55 11 99999-9999)'
        } as WAHAValidationResult)

    } catch (error: any) {
        console.error('Erro ao validar telefone com WAHA:', error)
        return NextResponse.json({
            isValid: false,
            exists: false,
            error: error.message || 'Erro de conexão ao validar telefone'
        } as WAHAValidationResult, { status: 500 })
    }
}
