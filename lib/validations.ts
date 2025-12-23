/**
 * Funções de validação para campos do formulário de usuário
 */

export interface ValidationResult {
  isValid: boolean
  error?: string
}

/**
 * Valida o nome do usuário
 * @param name - Nome a ser validado
 * @returns Resultado da validação
 */
export function validateName(name: string): ValidationResult {
  const trimmed = name.trim()
  
  // Nome é opcional, mas se preenchido deve ter formato válido
  if (trimmed === '') {
    return { isValid: true } // Opcional, então vazio é válido
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Nome deve ter no mínimo 2 caracteres'
    }
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Nome deve ter no máximo 100 caracteres'
    }
  }

  return { isValid: true }
}

/**
 * Valida o título do usuário
 * @param title - Título a ser validado
 * @returns Resultado da validação
 */
export function validateTitle(title: string): ValidationResult {
  const trimmed = title.trim()
  
  // Título é opcional, mas se preenchido deve ter formato válido
  if (trimmed === '') {
    return { isValid: true } // Opcional, então vazio é válido
  }

  if (trimmed.length < 2) {
    return {
      isValid: false,
      error: 'Título deve ter no mínimo 2 caracteres'
    }
  }

  if (trimmed.length > 100) {
    return {
      isValid: false,
      error: 'Título deve ter no máximo 100 caracteres'
    }
  }

  return { isValid: true }
}

/**
 * Valida o formato básico de telefone (regex)
 * @param phone - Telefone a ser validado
 * @returns Resultado da validação
 */
export function validatePhone(phone: string): ValidationResult {
  const trimmed = phone.trim()
  
  // Telefone é opcional
  if (trimmed === '') {
    return { isValid: true } // Opcional, então vazio é válido
  }

  // Remove espaços, parênteses, hífens e outros caracteres de formatação
  const digitsOnly = trimmed.replace(/[\s\-\(\)\+]/g, '')
  
  // Valida formato básico: deve conter apenas números e ter entre 10 e 15 dígitos
  // Aceita números internacionais com código do país
  const phoneRegex = /^\+?[1-9]\d{9,14}$/
  
  if (!phoneRegex.test(digitsOnly)) {
    return {
      isValid: false,
      error: 'Formato de telefone inválido. Use o formato: +55 11 99999-9999 ou similar'
    }
  }

  return { isValid: true }
}

/**
 * Valida o formato de hora (HH:mm)
 * @param time - Hora a ser validada
 * @returns Resultado da validação
 */
export function validateSendTime(time: string): ValidationResult {
  const trimmed = time.trim()
  
  // Hora é opcional
  if (trimmed === '') {
    return { isValid: true } // Opcional, então vazio é válido
  }

  // Valida formato HH:mm
  const timeRegex = /^([0-1][0-9]|2[0-3]):[0-5][0-9]$/
  
  if (!timeRegex.test(trimmed)) {
    return {
      isValid: false,
      error: 'Formato de hora inválido. Use o formato HH:mm (ex: 14:30)'
    }
  }

  return { isValid: true }
}

/**
 * Valida os itens do checklist
 * @param items - Array de itens do checklist
 * @returns Resultado da validação
 */
export function validateChecklist(items: string[]): ValidationResult {
  // Checklist é opcional
  if (!items || items.length === 0) {
    return { isValid: true } // Opcional, então vazio é válido
  }

  // Valida cada item
  for (let i = 0; i < items.length; i++) {
    const item = items[i].trim()
    
    if (item.length === 0) {
      return {
        isValid: false,
        error: `Item ${i + 1} do checklist não pode estar vazio`
      }
    }

    if (item.length > 200) {
      return {
        isValid: false,
        error: `Item ${i + 1} do checklist deve ter no máximo 200 caracteres`
      }
    }
  }

  return { isValid: true }
}

/**
 * Valida todos os campos do formulário de uma vez
 */
export interface UserFormValidation {
  name: ValidationResult
  title: ValidationResult
  phone: ValidationResult
  sendTime: ValidationResult
  checklist: ValidationResult
  isValid: boolean
}

export function validateUserForm(data: {
  name: string
  title: string
  phone: string
  sendTime: string
  checklist: string[]
}): UserFormValidation {
  const name = validateName(data.name)
  const title = validateTitle(data.title)
  const phone = validatePhone(data.phone)
  const sendTime = validateSendTime(data.sendTime)
  const checklist = validateChecklist(data.checklist)

  const isValid = name.isValid && title.isValid && phone.isValid && sendTime.isValid && checklist.isValid

  return {
    name,
    title,
    phone,
    sendTime,
    checklist,
    isValid
  }
}
