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

// Extrai os dois nomes do payload de /api/contacts. O engine GOWS devolve
// `pushname` (n minúsculo); versões anteriores usavam `pushName`. Ler só uma das
// grafias deixa o fallback morto sem erro nenhum — foi o que aconteceu até aqui.
export function parseContactPayload(data: any): {
  savedName: string | null
  pushName: string | null
} {
  const contact = Array.isArray(data) ? data[0] : data
  const texto = (valor: any): string | null => {
    if (typeof valor !== 'string') return null
    const limpo = valor.trim()
    return limpo.length > 0 ? limpo : null
  }
  return {
    savedName: texto(contact?.name),
    pushName: texto(contact?.pushname) ?? texto(contact?.pushName),
  }
}

export interface WhatsAppProfile {
  // Nome que o próprio dono do número definiu no WhatsApp.
  pushName: string | null
  // Como a conta que envia os lembretes tem esse número salvo na agenda.
  savedName: string | null
  profilePicUrl: string | null
  // null quando a verificação não pôde ser feita — diferente de false, que
  // significa "o WhatsApp respondeu que este número não existe".
  numberExists: boolean | null
}

// Não busca `about`: /api/contacts/about responde 501 no engine GOWS
// ("not implemented"), então a chamada só gastava uma requisição para gravar
// null. Se um dia o engine mudar, volta como um campo novo, não como um
// try/catch silencioso.
export async function fetchWhatsAppProfile(phone: string): Promise<WhatsAppProfile> {
  const session = process.env.WAHA_SESSION || 'default'
  const digits = phone.replace(/\D/g, '')
  const contactId = `${digits}@c.us`
  const client = wahaClient()

  // Número brasileiro existe em duas formas (com e sem o 9º dígito) e o envio já
  // tenta as duas via buildPhoneCandidates. Checar só uma delas faria o selo
  // dizer "não encontrado" para quem recebe as mensagens normalmente.
  const variante = generatePhoneVariant(digits)
  const candidatos = [...new Set([digits, ...(variante ? [variante] : [])])]

  // allSettled: foto indisponível não pode apagar o nome, e vice-versa.
  const [contatoR, fotoR, ...existeRs] = await Promise.allSettled([
    client.get('/api/contacts', { params: { contactId, session } }),
    client.get('/api/contacts/profile-picture', { params: { contactId, session } }),
    ...candidatos.map((p) => client.get('/api/contacts/check-exists', { params: { phone: p, session } })),
  ])

  const { savedName, pushName } =
    contatoR.status === 'fulfilled'
      ? parseContactPayload(contatoR.value.data)
      : { savedName: null, pushName: null }

  let profilePicUrl: string | null = null
  if (fotoR.status === 'fulfilled') {
    const d: any = fotoR.value.data
    const url = d?.profilePictureURL || d?.profilePicUrl || d?.url || null
    profilePicUrl = typeof url === 'string' && url.length > 0 ? url : null
  }

  // Basta um candidato existir. Só devolve null quando nenhuma checagem
  // completou — aí não se sabe, que é diferente de saber que não existe.
  const respostas = existeRs.filter((r) => r.status === 'fulfilled') as
    PromiseFulfilledResult<{ data: any }>[]
  const numberExists = respostas.length
    ? respostas.some((r) => Boolean(r.value.data?.numberExists))
    : null

  return { pushName, savedName, profilePicUrl, numberExists }
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
