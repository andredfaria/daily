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
  is_fixed?: unknown
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
  if (estado.is_fixed !== undefined && typeof estado.is_fixed !== 'boolean' &&
      estado.is_fixed !== 0 && estado.is_fixed !== 1) {
    return 'is_fixed deve ser booleano'
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

// Teto do DECIMAL(10,2) de bill_occurrences.amount.
const VALOR_MAXIMO = 99_999_999.99

/**
 * Valor real informado para uma ocorrência de conta variável. null volta a
 * ocorrência para a estimativa da conta. Devolve o valor arredondado em
 * centavos, ou a mensagem de erro.
 */
export function validarValorReal(valor: unknown): { valor: number | null } | { erro: string } {
  if (valor === null) return { valor: null }
  const n = typeof valor === 'number' ? valor : typeof valor === 'string' && valor.trim() !== '' ? Number(valor) : NaN
  if (!Number.isFinite(n) || n < 0 || n > VALOR_MAXIMO) {
    return { erro: 'amount deve ser um número entre 0 e 99.999.999,99, ou null para voltar à estimativa' }
  }
  return { valor: Math.round(n * 100) / 100 }
}

function normalizarCampo(valor: unknown): string {
  if (valor === undefined || valor === null || valor === '') return ''
  if (typeof valor === 'boolean') return valor ? '1' : '0'
  if (valor instanceof Date) {
    // DATE do mysql2 chega como meia-noite local; a data local é a gravada.
    const m = String(valor.getMonth() + 1).padStart(2, '0')
    const d = String(valor.getDate()).padStart(2, '0')
    return `${valor.getFullYear()}-${m}-${d}`
  }
  if (typeof valor === 'number') return String(valor)
  const s = String(valor)
  // "150.00" (DECIMAL do banco) e 150 (corpo JSON) são o mesmo valor.
  if (/^-?\d+(\.\d+)?$/.test(s)) return String(Number(s))
  // Data ISO com horário ("2026-10-05T00:00:00.000Z") compara só o dia.
  return /^\d{4}-\d{2}-\d{2}T/.test(s) ? s.slice(0, 10) : s
}

/**
 * Quais dos campos vieram no corpo com valor diferente do gravado. O formulário
 * de edição manda a conta inteira a cada salvamento, então "veio no corpo" não
 * quer dizer "mudou" — e tratar assim regerava as ocorrências a cada edição.
 */
export function camposAlterados(atual: Record<string, unknown>, corpo: Record<string, unknown>, campos: string[]): string[] {
  return campos.filter((c) => corpo[c] !== undefined && normalizarCampo(corpo[c]) !== normalizarCampo(atual[c]))
}
