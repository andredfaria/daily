/**
 * Regras de validação de uma conta. Ficam aqui, e não na rota, porque POST e
 * PATCH precisam cobrar exatamente as mesmas — antes o POST validava tudo e o
 * PATCH montava o UPDATE direto do corpo da requisição, aceitando valor
 * negativo, dia 99 ou um tipo de recorrência que a coluna nem tem.
 */

export const RECURRENCE_TYPES = [
  'monthly', 'weekly', 'once', 'biweekly', 'quarterly', 'semiannual', 'annual',
] as const

export type RecurrenceType = (typeof RECURRENCE_TYPES)[number]

// Qual campo cada recorrência precisa para o occurrenceGenerator conseguir gerar
// as datas. Sem essa checagem, uma conta trimestral sem dia do mês era aceita e
// nascia sem nenhuma ocorrência, em silêncio.
const CAMPO_EXIGIDO: Record<RecurrenceType, 'day_of_month' | 'day_of_week' | 'due_date'> = {
  monthly: 'day_of_month',
  quarterly: 'day_of_month',
  semiannual: 'day_of_month',
  annual: 'day_of_month',
  weekly: 'day_of_week',
  biweekly: 'day_of_week',
  once: 'due_date',
}

export interface EstadoConta {
  name?: unknown
  amount?: unknown
  recurrence_type?: unknown
  recurrence_day_of_month?: unknown
  recurrence_day_of_week?: unknown
  due_date?: unknown
  days_before_alert?: unknown
  is_active?: unknown
  [outros: string]: unknown
}

function inteiroEntre(valor: unknown, min: number, max: number): boolean {
  const n = Number(valor)
  return Number.isInteger(n) && n >= min && n <= max
}

function ausente(valor: unknown): boolean {
  return valor === undefined || valor === null || valor === ''
}

/**
 * Valida o estado FINAL da conta — o que vai ficar gravado. O POST passa o corpo
 * da requisição; o PATCH passa a linha atual já mesclada com os campos enviados.
 *
 * Devolve a mensagem de erro, ou null quando está tudo certo.
 */
export function validarConta(estado: EstadoConta): string | null {
  const { name, amount, recurrence_type } = estado

  if (typeof name !== 'string' || name.trim() === '') {
    return 'Campo obrigatório: name'
  }

  // Number.isFinite (em vez de isNaN) rejeita também Infinity: "1e400" passa no
  // isNaN e estoura a coluna DECIMAL(10,2) no INSERT.
  if (ausente(amount) || !Number.isFinite(Number(amount)) || Number(amount) < 0) {
    return 'Campo obrigatório: amount (número >= 0)'
  }

  if (typeof recurrence_type !== 'string' ||
      !RECURRENCE_TYPES.includes(recurrence_type as RecurrenceType)) {
    return `Campo obrigatório: recurrence_type (${RECURRENCE_TYPES.join(', ')})`
  }

  if (!ausente(estado.days_before_alert) && !inteiroEntre(estado.days_before_alert, 0, 30)) {
    return 'days_before_alert deve ser um inteiro entre 0 e 30'
  }
  if (!ausente(estado.recurrence_day_of_month) && !inteiroEntre(estado.recurrence_day_of_month, 1, 31)) {
    return 'recurrence_day_of_month deve ser um inteiro entre 1 e 31'
  }
  if (!ausente(estado.recurrence_day_of_week) && !inteiroEntre(estado.recurrence_day_of_week, 0, 6)) {
    return 'recurrence_day_of_week deve ser um inteiro entre 0 e 6'
  }
  // O MySQL devolve BOOLEAN como 1/0, então o estado mesclado do PATCH traz número.
  if (estado.is_active !== undefined && typeof estado.is_active !== 'boolean' &&
      estado.is_active !== 0 && estado.is_active !== 1) {
    return 'is_active deve ser booleano'
  }

  const exigido = CAMPO_EXIGIDO[recurrence_type as RecurrenceType]
  if (exigido === 'day_of_month' && ausente(estado.recurrence_day_of_month)) {
    return `recurrence_day_of_month é obrigatório para recorrência ${recurrence_type}`
  }
  if (exigido === 'day_of_week' && ausente(estado.recurrence_day_of_week)) {
    return `recurrence_day_of_week é obrigatório para recorrência ${recurrence_type}`
  }
  if (exigido === 'due_date' && ausente(estado.due_date)) {
    return 'due_date é obrigatório para recorrência pontual'
  }

  return null
}
