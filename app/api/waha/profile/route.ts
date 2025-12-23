import { NextRequest, NextResponse } from 'next/server'
import { getWhatsAppProfileServer, WAHAProfile } from '@/lib/waha'

export async function POST(request: NextRequest) {
    try {
        const { phone } = await request.json()

        if (!phone || phone.trim() === '') {
            return NextResponse.json({
                chatId: '',
                error: 'Telefone não pode estar vazio'
            } as WAHAProfile)
        }

        // Usa a função server-side do lib/waha.ts
        const profile = await getWhatsAppProfileServer(phone.trim())

        if (!profile) {
            return NextResponse.json({
                chatId: '',
                error: 'Erro ao buscar perfil do WhatsApp'
            } as WAHAProfile, { status: 500 })
        }

        return NextResponse.json(profile)

    } catch (error: any) {
        console.error('Erro ao buscar perfil do WhatsApp:', error)
        return NextResponse.json({
            chatId: '',
            error: error.message || 'Erro ao buscar perfil'
        } as WAHAProfile, { status: 500 })
    }
}
