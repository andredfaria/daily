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
  // Data URI, não a URL do CDN — ver o comentário de baixarFotoComoDataUri.
  profilePicUrl: string | null
  // null quando a verificação não pôde ser feita — diferente de false, que
  // significa "o WhatsApp respondeu que este número não existe".
  numberExists: boolean | null
}

// O whatsapp_number nem sempre é um telefone: usuário que só apareceu pelo
// webhook fica gravado com o LID (`51810291171433@lid`). Jogar isso num
// replace(/\D/g,'') virava `51810291171433@c.us`, um id que não existe — a
// busca respondia "número não encontrado" para quem tinha conta válida.
export function buildContactId(phone: string): string {
  const bruto = phone.trim()
  if (bruto.includes('@')) return bruto
  return `${bruto.replace(/\D/g, '')}@c.us`
}

// A grafia do campo muda entre engines (GOWS manda profilePictureURL); e o
// contato sem foto responde 200 com null, não 404.
export function parseProfilePictureUrl(data: any): string | null {
  const url = data?.profilePictureURL || data?.profilePicUrl || data?.url || null
  return typeof url === 'string' && url.length > 0 ? url : null
}

// Teto do que entra no JSON do perfil. As fotos do WhatsApp são 640x640 e giram
// em torno de 60 KB; 2 MB é folga para um caso fora da curva sem risco de a
// resposta do /profile virar um download.
export const TETO_FOTO_BYTES = 2 * 1024 * 1024

export function bufferParaDataUri(buf: Buffer, contentType?: string): string | null {
  if (!buf?.length || buf.length > TETO_FOTO_BYTES) return null
  const tipo = String(contentType ?? '').split(';')[0].trim().toLowerCase()
  // O CDN às vezes devolve application/octet-stream; jpeg é o formato que o
  // WhatsApp serve, então é o palpite seguro em vez de recusar a foto.
  const mime = tipo.startsWith('image/') ? tipo : 'image/jpeg'
  return `data:${mime};base64,${buf.toString('base64')}`
}

// O app roda sob `img-src 'self' data:` (nginx.conf). A URL que o WAHA devolve
// aponta para pps.whatsapp.net, então o navegador bloqueava a imagem e o card
// caía no ícone genérico — parecia "não achou a foto", mas a API sempre
// respondeu certo. Baixar aqui e mandar embutido resolve sem afrouxar o CSP e
// ainda tira de cima a URL assinada, que expira.
async function baixarFotoComoDataUri(url: string): Promise<string | null> {
  const emCache = fotoCache.get(url)
  if (emCache && emCache.expiraEm > Date.now()) return emCache.dataUri

  try {
    // Cliente próprio: é o CDN da Meta, não o WAHA — mandar o X-Api-Key para lá
    // seria vazar a chave.
    const resp = await axios.get(url, { responseType: 'arraybuffer', timeout: 10000 })
    const dataUri = bufferParaDataUri(Buffer.from(resp.data), resp.headers['content-type'])
    if (dataUri) guardarFoto(url, dataUri)
    return dataUri
  } catch (err: any) {
    console.warn(`[waha] falha ao baixar foto de perfil: ${err?.message ?? err}`)
    return null
  }
}

// Cache curto porque a URL assinada já muda sozinha; serve só para as duas
// telas que pedem o perfil não baixarem 60 KB da Meta a cada abertura.
const fotoCache = new Map<string, { dataUri: string; expiraEm: number }>()
const FOTO_TTL_MS = 10 * 60 * 1000

function guardarFoto(url: string, dataUri: string): void {
  // Poda o que já venceu antes de crescer: sem isso o Map só aumenta, já que
  // cada refresh do WhatsApp gera uma URL nova.
  const agora = Date.now()
  for (const [k, v] of fotoCache) if (v.expiraEm <= agora) fotoCache.delete(k)
  fotoCache.set(url, { dataUri, expiraEm: agora + FOTO_TTL_MS })
}

interface DadosContato {
  savedName: string | null
  pushName: string | null
  picUrl: string | null
}

async function buscarContato(contactId: string, session: string): Promise<DadosContato> {
  const client = wahaClient()
  // allSettled: foto indisponível não pode apagar o nome, e vice-versa.
  const [contatoR, fotoR] = await Promise.allSettled([
    client.get('/api/contacts', { params: { contactId, session } }),
    client.get('/api/contacts/profile-picture', { params: { contactId, session } }),
  ])

  const { savedName, pushName } =
    contatoR.status === 'fulfilled'
      ? parseContactPayload(contatoR.value.data)
      : { savedName: null, pushName: null }

  return {
    savedName,
    pushName,
    picUrl: fotoR.status === 'fulfilled' ? parseProfilePictureUrl(fotoR.value.data) : null,
  }
}

// Não busca `about`: /api/contacts/about responde 501 no engine GOWS
// ("not implemented"), então a chamada só gastava uma requisição para gravar
// null. Se um dia o engine mudar, volta como um campo novo, não como um
// try/catch silencioso.
export async function fetchWhatsAppProfile(phone: string): Promise<WhatsAppProfile> {
  const session = process.env.WAHA_SESSION || 'default'
  const digits = phone.replace(/\D/g, '')
  const client = wahaClient()

  // Número brasileiro existe em duas formas (com e sem o 9º dígito) e o envio já
  // tenta as duas via buildPhoneCandidates. Checar só uma delas faria o selo
  // dizer "não encontrado" para quem recebe as mensagens normalmente.
  // Um LID não é telefone: mandá-lo para /check-exists devolve "não existe" e o
  // card acusava conta inválida de quem recebe mensagem todo dia. Sem candidato,
  // numberExists fica null — "não dá para saber", que é a verdade.
  const ehLid = phone.includes('@')
  const variante = ehLid ? null : generatePhoneVariant(digits)
  const candidatos = ehLid ? [] : [...new Set([digits, ...(variante ? [variante] : [])])]

  const [contatoPrincipal, ...existeRs] = await Promise.all([
    buscarContato(buildContactId(phone), session),
    ...candidatos.map((p) =>
      client
        .get('/api/contacts/check-exists', { params: { phone: p, session } })
        .then((r) => r.data)
        .catch(() => null)
    ),
  ])

  // A forma errada do número responde 200 com tudo vazio, não erro. Quando não
  // veio nome nem foto, a outra grafia do 9º dígito ainda pode ser a certa.
  let contato = contatoPrincipal
  if (variante && !contato.picUrl && !contato.savedName && !contato.pushName) {
    contato = await buscarContato(buildContactId(variante), session)
  }

  const profilePicUrl = contato.picUrl ? await baixarFotoComoDataUri(contato.picUrl) : null

  // Basta um candidato existir. Só devolve null quando nenhuma checagem
  // completou — aí não se sabe, que é diferente de saber que não existe.
  const respostas = existeRs.filter((d) => d !== null)
  const numberExists = respostas.length ? respostas.some((d: any) => Boolean(d?.numberExists)) : null

  return { pushName: contato.pushName, savedName: contato.savedName, profilePicUrl, numberExists }
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
