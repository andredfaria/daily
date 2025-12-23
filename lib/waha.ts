/**
 * Utilitário para validação de telefone usando WAHA (WhatsApp HTTP API)
 */

export interface WAHAValidationResult {
  isValid: boolean
  exists: boolean
  validatedPhone?: string  // Número para exibição (sem @c.us)
  chatId?: string          // chatId completo para salvar no backend (com @c.us)
  error?: string
}

/**
 * Valida um número de telefone usando o endpoint WAHA /api/contacts/check-exists
 * @param phone - Número de telefone a ser validado
 * @returns Resultado da validação com informações se o número existe no WhatsApp
 */
export async function validatePhoneWithWAHA(phone: string): Promise<WAHAValidationResult> {
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      exists: false,
      error: 'Telefone não pode estar vazio'
    }
  }

  const wahaUrl = process.env.NEXT_PUBLIC_WAHA_BASE_URL || ''

  if (!wahaUrl) {
    return {
      isValid: false,
      exists: false,
      error: 'URL do WAHA não configurada. Configure NEXT_PUBLIC_WAHA_BASE_URL no arquivo .env.local'
    }
  }

  try {
    const normalizedPhone = phone.trim()
    const endpoint = `${wahaUrl.replace(/\/$/, '')}/api/contacts/check-exists?phone=${normalizedPhone.replace(/\D/g, '')}&session=default`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        ...(process.env.NEXT_PUBLIC_WAHA_API_KEY && { 'X-Api-Key': process.env.NEXT_PUBLIC_WAHA_API_KEY }),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      let errorMessage = `Erro ao validar telefone: ${response.status} ${errorText || response.statusText}`

      // Adicionar sugestão sobre o "9" no início para números brasileiros
      if (normalizedPhone.includes('55') || normalizedPhone.startsWith('+55')) {
        errorMessage += '. Dica: números brasileiros geralmente precisam do "9" no início do número (ex: +55 11 99999-9999)'
      }

      return {
        isValid: false,
        exists: false,
        error: errorMessage
      }
    }

    const data = await response.json()

    // WAHA retorna { numberExists: boolean, chatId: string }
    // chatId está no formato "123123123@c.us"
    const exists = data.numberExists === true
    const chatId = data.chatId || null

    // Extrai o número do chatId (remove @c.us)
    let validatedPhone: string | undefined = undefined
    if (chatId && typeof chatId === 'string') {
      validatedPhone = chatId.split('@')[0]
    }

    return {
      isValid: true,
      exists: exists,
      validatedPhone: exists ? validatedPhone : undefined,
      chatId: exists ? chatId : undefined,
      error: exists ? undefined : 'Número não encontrado no WhatsApp. Verifique se o número está correto. Dica: números brasileiros geralmente precisam do "9" no início (ex: +55 11 99999-9999)'
    }
  } catch (error: any) {
    console.error('Erro ao validar telefone com WAHA:', error)
    let errorMessage = error.message || 'Erro de conexão ao validar telefone. Verifique sua conexão e a configuração do WAHA.'

    // Adicionar sugestão sobre o "9" no início para números brasileiros
    if (phone.includes('55') || phone.startsWith('+55')) {
      errorMessage += ' Dica: números brasileiros geralmente precisam do "9" no início do número (ex: +55 11 99999-9999)'
    }

    return {
      isValid: false,
      exists: false,
      error: errorMessage
    }
  }

}

export interface WAHAProfile {
  pushname?: string
  about?: string
  profilePicUrl?: string
  chatId: string
  error?: string
}

/**
 * Busca informações completas do perfil do WhatsApp (Foto, Recado/About, Nome)
 * @param phone - Número de telefone
 */
export async function getWhatsAppProfile(phone: string): Promise<WAHAProfile | null> {
  const wahaUrl = process.env.NEXT_PUBLIC_WAHA_BASE_URL || ''

  if (!wahaUrl) {
    console.error('URL do WAHA não configurada')
    return null
  }

  try {
    // 1. Primeiro valida o número para pegar o chatId correto
    const validation = await validatePhoneWithWAHA(phone)

    if (!validation.exists || !validation.chatId) {
      return {
        chatId: '',
        error: 'Número não encontrado no WhatsApp'
      }
    }

    const chatId = validation.chatId
    const headers = {
      'accept': 'application/json',
      ...(process.env.NEXT_PUBLIC_WAHA_API_KEY && { 'X-Api-Key': process.env.NEXT_PUBLIC_WAHA_API_KEY }),
    }

    const requests = [
      // 2. Busca foto de perfil
      fetch(
        `${wahaUrl.replace(/\/$/, '')}/api/contacts/profile-picture?contactId=${chatId}&session=default`,
        { method: 'GET', headers }
      ).then(r => r.ok ? r.json() : null).catch(() => null),

      // 3. Busca recado (About)
      fetch(
        `${wahaUrl.replace(/\/$/, '')}/api/contacts/about?contactId=${chatId}&session=default`,
        { method: 'GET', headers }
      ).then(r => r.ok ? r.json() : null).catch(() => null),

      // 4. Busca dados do contato (Pushname)
      fetch(
        `${wahaUrl.replace(/\/$/, '')}/api/contacts?contactId=${chatId}&session=default`,
        { method: 'GET', headers }
      ).then(r => r.ok ? r.json() : null).catch(() => null)
    ]

    const [picData, aboutData, contactData] = await Promise.all(requests)

    return {
      chatId,
      profilePicUrl: picData?.profilePictureURL || picData?.url,
      about: aboutData?.about || aboutData?.status,
      pushname: contactData?.pushname
    }

  } catch (error) {
    console.error('Erro ao buscar perfil do WhatsApp:', error)
    return null
  }
}
