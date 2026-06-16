import axios from 'axios'

export function wahaClient() {
  return axios.create({
    baseURL: process.env.WAHA_URL || 'http://localhost:3000',
    headers: {
      'X-Api-Key': process.env.WAHA_API_KEY || '',
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  })
}

export class WhatsAppNumberNotFoundError extends Error {
  constructor(phone: string) {
    super(`Número não encontrado no WhatsApp: ${phone}`)
    this.name = 'WhatsAppNumberNotFoundError'
  }
}

async function lookupChatId(digits: string, session: string): Promise<string | null> {
  try {
    const { data } = await wahaClient().get('/api/contacts/check-exists', {
      params: { phone: digits, session },
    })
    if (data?.numberExists === true && data?.chatId) return data.chatId as string
    return null
  } catch {
    return null
  }
}

/**
 * Gera a variante de um numero brasileiro (adiciona ou remove o 9 apos o DDD).
 * Retorna null se o numero nao for 12 ou 13 digitos.
 */
export function generatePhoneVariant(digits: string): string | null {
  if (digits.length === 12) {
    // 55 + DD(2) + 8 digitos -> insere o 9 apos o DDD
    return digits.slice(0, 4) + '9' + digits.slice(4)
  }
  if (digits.length === 13) {
    // 55 + DD(2) + 9 + 8 digitos -> remove o 9 apos o DDD
    return digits.slice(0, 4) + digits.slice(5)
  }
  return null
}

/**
 * Constrói a lista de candidatos de whatsapp_number para busca no banco.
 * Sempre inclui digits, resolvedNumber e a variante com/sem 9 — sem duplicatas.
 * Funciona sem WAHA disponível (usa apenas manipulação de string).
 */
export function buildPhoneCandidates(digits: string, resolvedNumber: string): string[] {
  const variant = generatePhoneVariant(digits)
  return [...new Set([digits, resolvedNumber, ...(variant ? [variant] : [])])]
}

async function resolveWhatsAppChatId(phone: string): Promise<string> {
  const digits = phone.replace(/\D/g, '')
  const session = process.env.WAHA_SESSION || 'default'

  const chatId = await lookupChatId(digits, session)
  if (chatId) return chatId

  const variant = generatePhoneVariant(digits)
  if (variant) {
    const variantChatId = await lookupChatId(variant, session)
    if (variantChatId) return variantChatId
  }

  throw new WhatsAppNumberNotFoundError(phone)
}

/**
 * Resolve o numero de telefone para o formato correto no WhatsApp.
 * Retorna apenas os digitos canonicos (sem @c.us).
 * Lanca WhatsAppNumberNotFoundError se nenhuma variante existir.
 */
export async function resolveWhatsAppNumber(phone: string): Promise<string> {
  const chatId = await resolveWhatsAppChatId(phone)
  return chatId.replace('@c.us', '')
}

/**
 * Valida a existencia do numero no WhatsApp (tentando com e sem o 9),
 * usa o chatId retornado pela API e envia a mensagem.
 * Lanca WhatsAppNumberNotFoundError se o numero nao existir.
 */
export async function sendWhatsAppText(
  phone: string,
  text: string,
): Promise<{ id: string | null }> {
  const chatId = await resolveWhatsAppChatId(phone)
  const session = process.env.WAHA_SESSION || 'default'
  const { data } = await wahaClient().post('/api/sendText', { session, chatId, text })
  return { id: data.id ?? data.key?.id ?? null }
}

export async function sendWhatsAppOtpButton(
  phone: string,
  code: string,
): Promise<{ id: string | null }> {
  const chatId = await resolveWhatsAppChatId(phone)
  const session = process.env.WAHA_SESSION || 'default'
  const { data } = await wahaClient().post('/api/sendButtons', {
    session,
    chatId,
    body: `Seu código de acesso BillSync:`,
    footer: 'Válido por 5 minutos. Não compartilhe.',
    buttons: [
      {
        type: 'copy',
        text: 'Copiar código',
        copyCode: code,
      },
    ],
  })
  return { id: data.id ?? data.key?.id ?? null }
}

export async function sendWhatsAppPoll(
  phone: string,
  name: string,
  options: string[],
): Promise<{ id: string | null }> {
  const chatId = await resolveWhatsAppChatId(phone)
  const session = process.env.WAHA_SESSION || 'default'
  const { data } = await wahaClient().post('/api/sendPoll', {
    session,
    chatId,
    poll: {
      name,
      options,
      multipleAnswers: true,
    },
  })
  return { id: data.id ?? data.key?.id ?? null }
}

export async function fetchWhatsAppName(phone: string): Promise<string | null> {
  try {
    const session = process.env.WAHA_SESSION || 'default'
    const digits = phone.replace(/\D/g, '')
    const { data } = await wahaClient().get('/api/contacts', {
      params: { contactId: `${digits}@c.us`, session },
    })
    const name =
      data?.name ||
      data?.pushName ||
      (Array.isArray(data) && (data[0]?.name || data[0]?.pushName)) ||
      null
    return typeof name === 'string' ? name : null
  } catch {
    return null
  }
}

export async function fetchWhatsAppProfile(phone: string): Promise<{
  name: string | null
  about: string | null
  profilePicUrl: string | null
}> {
  const session = process.env.WAHA_SESSION || 'default'
  const digits = phone.replace(/\D/g, '')
  const contactId = `${digits}@c.us`

  let name: string | null = null
  let about: string | null = null
  let profilePicUrl: string | null = null

  try {
    const { data } = await wahaClient().get('/api/contacts', {
      params: { contactId, session },
    })
    const contact = Array.isArray(data) ? data[0] : data
    name = contact?.name || contact?.pushName || null
    about = contact?.about || null
    if (typeof name !== 'string') name = null
    if (typeof about !== 'string') about = null
  } catch {
    // sem nome/bio disponíveis
  }

  try {
    const { data } = await wahaClient().get('/api/contacts/profile-picture', {
      params: { contactId, session },
    })
    const url = data?.profilePictureURL || data?.profilePicUrl || data?.url || null
    profilePicUrl = typeof url === 'string' ? url : null
  } catch {
    // foto não disponível (WAHA Core ou privacidade)
  }

  return { name, about, profilePicUrl }
}

export async function getWahaWebhookStatus(backendPublicUrl: string): Promise<{
  registered: boolean
  url: string
  webhooks: any[]
}> {
  const session = process.env.WAHA_SESSION || 'default'
  const webhookUrl = backendPublicUrl
    ? `${backendPublicUrl.replace(/\/$/, '')}/api/webhooks/waha-poll`
    : ''
  const { data } = await wahaClient().get(`/api/sessions/${session}`)
  const webhooks: any[] = data?.config?.webhooks ?? data?.webhooks ?? []
  const registered = webhooks.some((w: any) => String(w.url ?? '').includes('/api/webhooks/waha-poll'))
  return { registered, url: webhookUrl, webhooks }
}

export async function configureWahaWebhook(backendPublicUrl: string): Promise<void> {
  if (!backendPublicUrl) {
    console.warn('[waha] BACKEND_PUBLIC_URL não definido — webhook não configurado')
    return
  }

  const session = process.env.WAHA_SESSION || 'default'
  const webhookUrl = `${backendPublicUrl.replace(/\/$/, '')}/api/webhooks/waha-poll`
  const webhookEntry = { url: webhookUrl, events: ['poll.vote', 'poll.vote.failed'] }

  try {
    try {
      await wahaClient().put(`/api/sessions/${session}`, { config: { webhooks: [webhookEntry] } })
    } catch (err: any) {
      if (err.response?.status >= 400 && err.response?.status < 500) {
        console.log('[waha] tentando formato legado de webhook...')
        await wahaClient().put(`/api/sessions/${session}`, { webhooks: [webhookEntry] })
      } else {
        throw err
      }
    }

    const status = await getWahaWebhookStatus(backendPublicUrl)
    if (status.registered) {
      console.log(`[waha] webhook confirmado ✓: ${webhookUrl}`)
    } else {
      console.warn(`[waha] webhook NÃO confirmado na sessão — verificar configuração do WAHA`)
    }
  } catch (err: any) {
    const detail =
      err.response?.data?.message ??
      err.response?.data?.error ??
      err.message ??
      'erro desconhecido'
    console.warn(`[waha] não foi possível configurar webhook: ${detail}`)
  }
}
