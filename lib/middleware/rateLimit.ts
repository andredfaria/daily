/**
 * Rate limiting simples em memória
 * Para produção, considere usar Redis ou serviço dedicado
 */

interface RateLimitStore {
  [key: string]: {
    count: number
    resetAt: number
  }
}

const store: RateLimitStore = {}

/**
 * Limpa entradas expiradas periodicamente
 */
if (typeof window === 'undefined') {
  setInterval(() => {
    const now = Date.now()
    for (const key in store) {
      if (store[key].resetAt < now) {
        delete store[key]
      }
    }
  }, 60000) // Limpa a cada minuto
}

interface RateLimitOptions {
  windowMs: number // Janela de tempo em ms
  maxRequests: number // Máximo de requisições por janela
  keyGenerator?: (req: Request) => string // Função para gerar chave única
}

const defaultKeyGenerator = (req: Request): string => {
  // Tenta pegar IP do header (Vercel/proxy)
  const forwarded = req.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
  
  // Combina IP + path para limitar por rota
  const path = new URL(req.url).pathname
  return `${ip}:${path}`
}

/**
 * Middleware de rate limiting
 */
export function rateLimit(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyGenerator = defaultKeyGenerator } = options

  return async (req: Request): Promise<{ allowed: boolean; remaining: number; resetAt: number }> => {
    const key = keyGenerator(req)
    const now = Date.now()

    let record = store[key]

    // Se não existe ou expirou, criar novo
    if (!record || record.resetAt < now) {
      record = {
        count: 0,
        resetAt: now + windowMs,
      }
      store[key] = record
    }

    // Incrementar contador
    record.count++

    const remaining = Math.max(0, maxRequests - record.count)
    const allowed = record.count <= maxRequests

    return {
      allowed,
      remaining,
      resetAt: record.resetAt,
    }
  }
}

/**
 * Helper para criar rate limiter comum
 */
export const createRateLimiter = () => {
  // Limite padrão: 100 requisições por minuto
  return rateLimit({
    windowMs: 60 * 1000, // 1 minuto
    maxRequests: 100,
  })
}

/**
 * Rate limiter mais restritivo para endpoints sensíveis
 */
export const createStrictRateLimiter = () => {
  // Limite: 10 requisições por minuto
  return rateLimit({
    windowMs: 60 * 1000,
    maxRequests: 10,
  })
}
