/**
 * Utilitários para sanitização de inputs
 * Previne XSS e valida dados
 */

/**
 * Remove tags HTML e caracteres perigosos
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return String(input)
  }

  // Remove tags HTML
  let sanitized = input.replace(/<[^>]*>/g, '')

  // Remove caracteres de controle
  sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '')

  // Trim espaços extras
  sanitized = sanitized.trim()

  return sanitized
}

/**
 * Sanitiza um objeto recursivamente
 */
export function sanitizeObject<T>(obj: T): T {
  if (typeof obj === 'string') {
    return sanitizeString(obj) as unknown as T
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item)) as unknown as T
  }

  if (obj && typeof obj === 'object') {
    const sanitized = {} as T
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeObject(obj[key])
      }
    }
    return sanitized
  }

  return obj
}

/**
 * Valida se é um número válido
 */
export function sanitizeNumber(value: unknown): number | null {
  if (typeof value === 'number' && !isNaN(value)) {
    return value
  }

  if (typeof value === 'string') {
    const parsed = parseFloat(value)
    if (!isNaN(parsed)) {
      return parsed
    }
  }

  return null
}

/**
 * Valida se é um ID válido (número positivo)
 */
export function sanitizeId(value: unknown): number | null {
  const num = sanitizeNumber(value)
  if (num !== null && num > 0 && Number.isInteger(num)) {
    return num
  }
  return null
}
