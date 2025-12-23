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
