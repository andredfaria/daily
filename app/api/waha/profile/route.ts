import { NextRequest, NextResponse } from 'next/server'

export interface WAHAProfile {
    pushname?: string
    about?: string
    profilePicUrl?: string
    chatId: string
    error?: string
}

export async function POST(request: NextRequest) {
    try {
        const { phone } = await request.json()

        const wahaUrl = process.env.WAHA_BASE_URL || ''
        const wahaApiKey = process.env.WAHA_API_KEY || ''

        if (!wahaUrl) {
            return NextResponse.json({
                chatId: '',
                error: 'URL do WAHA não configurada no servidor'
            } as WAHAProfile)
        }

        // First validate the phone to get the correct chatId
        const validateEndpoint = `${wahaUrl.replace(/\/$/, '')}/api/contacts/check-exists?phone=${phone.replace(/\D/g, '')}&session=default`

        const headers = {
            'accept': 'application/json',
            ...(wahaApiKey && { 'X-Api-Key': wahaApiKey }),
        }

        const validateResponse = await fetch(validateEndpoint, {
            method: 'GET',
            headers,
        })

        if (!validateResponse.ok) {
            return NextResponse.json({
                chatId: '',
                error: 'Número não encontrado no WhatsApp'
            } as WAHAProfile)
        }

        const validateData = await validateResponse.json()

        if (!validateData.numberExists || !validateData.chatId) {
            return NextResponse.json({
                chatId: '',
                error: 'Número não encontrado no WhatsApp'
            } as WAHAProfile)
        }

        const chatId = validateData.chatId

        // Fetch profile data in parallel
        const requests = [
            // Profile picture
            fetch(
                `${wahaUrl.replace(/\/$/, '')}/api/contacts/profile-picture?contactId=${chatId}&session=default`,
                { method: 'GET', headers }
            ).then(r => r.ok ? r.json() : null).catch(() => null),

            // About/Status
            fetch(
                `${wahaUrl.replace(/\/$/, '')}/api/contacts/about?contactId=${chatId}&session=default`,
                { method: 'GET', headers }
            ).then(r => r.ok ? r.json() : null).catch(() => null),

            // Contact data (Pushname)
            fetch(
                `${wahaUrl.replace(/\/$/, '')}/api/contacts?contactId=${chatId}&session=default`,
                { method: 'GET', headers }
            ).then(r => r.ok ? r.json() : null).catch(() => null)
        ]

        const [picData, aboutData, contactData] = await Promise.all(requests)

        return NextResponse.json({
            chatId,
            profilePicUrl: picData?.profilePictureURL || picData?.url,
            about: aboutData?.about || aboutData?.status,
            pushname: contactData?.pushname
        } as WAHAProfile)

    } catch (error: any) {
        console.error('Erro ao buscar perfil do WhatsApp:', error)
        return NextResponse.json({
            chatId: '',
            error: error.message || 'Erro ao buscar perfil'
        } as WAHAProfile, { status: 500 })
    }
}
