/**
 * Utilitário para validação de telefone usando WAHA (WhatsApp HTTP API)
 * Este arquivo contém tanto funções client-side (para componentes) quanto server-side (para API routes)
 */

export interface WAHAValidationResult {
  isValid: boolean
  exists: boolean
  validatedPhone?: string  // Número para exibição (sem @c.us)
  chatId?: string          // chatId completo para salvar no backend (com @c.us)
  error?: string
}

export interface WAHAProfile {
  pushname?: string
  about?: string
  profilePicUrl?: string
  chatId: string
  error?: string
}

// ============================================
// CLIENT-SIDE FUNCTIONS (For Components)
// ============================================

/**
 * Valida um número de telefone chamando a API route segura
 * USO: Componentes React no frontend
 */
export async function validatePhoneWithWAHA(phone: string): Promise<WAHAValidationResult> {
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      exists: false,
      error: 'Telefone não pode estar vazio'
    }
  }

  try {
    const response = await fetch('/api/waha/validate-phone', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: phone.trim() }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: WAHAValidationResult = await response.json()
    return result

  } catch (error: unknown) {
    console.error('Erro ao validar telefone:', error)
    return {
      isValid: false,
      exists: false,
      error: error instanceof Error ? error.message : 'Erro de conexão ao validar telefone'
    }
  }
}

/**
 * Busca informações completas do perfil do WhatsApp chamando a API route segura
 * USO: Componentes React no frontend
 */
export async function getWhatsAppProfile(phone: string): Promise<WAHAProfile | null> {
  try {
    const response = await fetch('/api/waha/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ phone: phone.trim() }),
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const result: WAHAProfile = await response.json()

    if (result.error) {
      console.error('Erro ao buscar perfil:', result.error)
      return null
    }

    return result

  } catch (error) {
    console.error('Erro ao buscar perfil do WhatsApp:', error)
    return null
  }
}

// ============================================
// SERVER-SIDE FUNCTIONS (For API Routes)
// ============================================

/**
 * Helper para validar variáveis de ambiente do WAHA
 * @returns Object com wahaUrl e wahaApiKey (se configurado), ou erro
 */
function validateWAHAEnvironment(): { wahaUrl: string; wahaApiKey?: string; error?: string } {
  const wahaUrl = process.env.WAHA_BASE_URL || ''
  const wahaApiKey = process.env.WAHA_API_KEY || ''

  if (!wahaUrl) {
    return {
      wahaUrl: '',
      error: 'URL do WAHA não configurada. Configure WAHA_BASE_URL no arquivo .env.local'
    }
  }

  return {
    wahaUrl,
    ...(wahaApiKey && { wahaApiKey })
  }
}

/**
 * Helper para adicionar dica sobre formato de telefone brasileiro
 * @param phone Número de telefone
 * @returns Texto com dica se for número brasileiro
 */
function getBrazilianPhoneTip(phone: string): string {
  const isBrazilian = phone.includes('55') || phone.startsWith('+55')
  return isBrazilian
    ? ' Dica: números brasileiros geralmente precisam do "9" no início (ex: +55 11 99999-9999)'
    : ''
}

/**
 * Valida um número de telefone diretamente com WAHA
 * USO: Apenas em API routes ou Server Components
 * IMPORTANTE: Requer variáveis WAHA_API_KEY e WAHA_BASE_URL
 */
export async function validatePhoneWithWAHAServer(phone: string): Promise<WAHAValidationResult> {
  if (!phone || phone.trim() === '') {
    return {
      isValid: false,
      exists: false,
      error: 'Telefone não pode estar vazio'
    }
  }

  // Validar ambiente
  const env = validateWAHAEnvironment()
  if (env.error) {
    return {
      isValid: false,
      exists: false,
      error: env.error
    }
  }

  try {
    const normalizedPhone = phone.trim().replace(/\D/g, '')
    const endpoint = `${env.wahaUrl.replace(/\/$/, '')}/api/contacts/check-exists?phone=${normalizedPhone}&session=default`

    const response = await fetch(endpoint, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        ...(env.wahaApiKey && { 'X-Api-Key': env.wahaApiKey }),
      },
    })

    if (!response.ok) {
      const errorText = await response.text()
      const errorMessage = `Erro ao validar telefone: ${response.status} ${errorText || response.statusText}${getBrazilianPhoneTip(phone)}`

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
      error: exists ? undefined : `Número não encontrado no WhatsApp. Verifique se o número está correto.${getBrazilianPhoneTip(phone)}`
    }
  } catch (error: unknown) {
    console.error('Erro ao validar telefone com WAHA:', error)
    const errorMessage = `${error instanceof Error ? error.message : 'Erro de conexão ao validar telefone. Verifique sua conexão e a configuração do WAHA.'}${getBrazilianPhoneTip(phone)}`

    return {
      isValid: false,
      exists: false,
      error: errorMessage
    }
  }

}

/**
 * Busca informações completas do perfil do WhatsApp diretamente com WAHA
 * USO: Apenas em API routes ou Server Components
 * IMPORTANTE: Requer variáveis WAHA_API_KEY e WAHA_BASE_URL
 */
export async function getWhatsAppProfileServer(phone: string): Promise<WAHAProfile | null> {
  // Validar ambiente
  const env = validateWAHAEnvironment()
  if (env.error) {
    console.error('Erro de configuração WAHA:', env.error)
    return null
  }

  try {
    // 1. Primeiro valida o número para pegar o chatId correto
    const validation = await validatePhoneWithWAHAServer(phone)

    if (!validation.exists || !validation.chatId) {
      return {
        chatId: '',
        error: 'Número não encontrado no WhatsApp'
      }
    }

    const chatId = validation.chatId
    const headers = {
      'accept': 'application/json',
      ...(env.wahaApiKey && { 'X-Api-Key': env.wahaApiKey }),
    }

    const requests = [
      // 2. Busca foto de perfil
      fetch(
        `${env.wahaUrl.replace(/\/$/, '')}/api/contacts/profile-picture?contactId=${chatId}&session=default`,
        { method: 'GET', headers }
      ).then(r => r.ok ? r.json() : null).catch(() => null),

      // 3. Busca recado (About)
      fetch(
        `${env.wahaUrl.replace(/\/$/, '')}/api/contacts/about?contactId=${chatId}&session=default`,
        { method: 'GET', headers }
      ).then(r => r.ok ? r.json() : null).catch(() => null),

      // 4. Busca dados do contato (Pushname)
      fetch(
        `${env.wahaUrl.replace(/\/$/, '')}/api/contacts?contactId=${chatId}&session=default`,
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
