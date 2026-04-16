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
