/**
 * Constantes centralizadas da aplicação
 */

// Limites de validação
export const VALIDATION_LIMITS = {
  NAME: {
    MIN: 2,
    MAX: 100,
  },
  TITLE: {
    MIN: 2,
    MAX: 100,
  },
  CHECKLIST_ITEM: {
    MAX: 200,
  },
  CHECKLIST_ITEMS: {
    MAX: 50,
  },
  PHONE: {
    MIN_DIGITS: 10,
    MAX_DIGITS: 15,
  },
} as const

// Mensagens de erro padrão
export const ERROR_MESSAGES = {
  REQUIRED: 'Este campo é obrigatório',
  INVALID_FORMAT: 'Formato inválido',
  TOO_SHORT: (min: number) => `Deve ter no mínimo ${min} caracteres`,
  TOO_LONG: (max: number) => `Deve ter no máximo ${max} caracteres`,
  NETWORK_ERROR: 'Erro de conexão. Verifique sua internet e tente novamente.',
  UNAUTHORIZED: 'Você não tem permissão para realizar esta ação',
  NOT_FOUND: 'Recurso não encontrado',
  RATE_LIMIT: 'Muitas requisições. Aguarde um momento antes de tentar novamente.',
} as const

// Mensagens de sucesso
export const SUCCESS_MESSAGES = {
  CREATED: 'Criado com sucesso!',
  UPDATED: 'Atualizado com sucesso!',
  DELETED: 'Removido com sucesso!',
  SAVED: 'Salvo com sucesso!',
} as const

// Configurações de paginação
export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 100,
  DEFAULT_PAGE: 1,
} as const

// Configurações de rate limiting
export const RATE_LIMIT = {
  STANDARD: {
    WINDOW_MS: 60 * 1000, // 1 minuto
    MAX_REQUESTS: 100,
  },
  STRICT: {
    WINDOW_MS: 60 * 1000, // 1 minuto
    MAX_REQUESTS: 10,
  },
} as const

// Timeouts (em ms)
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30 segundos
  PHONE_VALIDATION: 10000, // 10 segundos
  DEBOUNCE: 300, // 300ms
} as const
