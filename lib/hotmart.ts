import crypto from 'crypto'

/**
 * Valida o token recebido do webhook da Hotmart usando comparação segura contra timing attacks.
 */
export function validateHotmartToken(token: string | undefined): boolean {
  if (!token) {
    return false
  }

  const configuredToken = process.env.HOTMART_WEBHOOK_TOKEN

  if (!configuredToken) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[HOTMART] HOTMART_WEBHOOK_TOKEN não configurado - permitindo em modo desenvolvimento')
      return true
    }
    console.error('[HOTMART] HOTMART_WEBHOOK_TOKEN não configurado em produção')
    return false
  }

  // Comparação segura contra timing attacks
  const a = Buffer.from(token)
  const b = Buffer.from(configuredToken)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}
