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

async function numberExistsOnWhatsApp(digits: string, session: string): Promise<boolean> {
  try {
    const { data } = await wahaClient().get('/api/contacts/check-exists', {
      params: { phone: digits, session },
    })
    return data?.numberExists === true
  } catch {
    return false
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
 * Resolve o numero de telefone para o formato correto no WhatsApp.
 * Numeros brasileiros podem ter 12 digitos (sem o 9) ou 13 digitos (com o 9).
 * Verifica qual variante esta registrada no WhatsApp e retorna essa.
 */
export async function resolveWhatsAppNumber(phone: string): Promise<string> {
  const digits = phone.replace(/\D/g, '')
  const session = process.env.WAHA_SESSION || 'default'

  if (await numberExistsOnWhatsApp(digits, session)) return digits

  const variant = generatePhoneVariant(digits)
  if (variant && await numberExistsOnWhatsApp(variant, session)) return variant

  return digits // fallback: tenta com o numero original
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
