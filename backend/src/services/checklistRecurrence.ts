// Regras de recorrência do checklist. Módulo puro, sem banco nem rede, para os
// testes rodarem sem abrir o pool do MySQL — mesmo padrão de checklistInactivity.

/**
 * Dia da semana em São Paulo (0=Dom, 6=Sáb).
 *
 * O container roda em UTC. Com `new Date().getDay()`, um checklist das 21h BRT
 * era avaliado já no dia seguinte em UTC, e as recorrências `weekdays` e
 * `custom` disparavam no dia errado.
 */
export function getDayOfWeekSaoPaulo(agora = new Date()): number {
  const dias: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    weekday: 'short',
  }).formatToParts(agora)
  return dias[parts.find((p) => p.type === 'weekday')?.value ?? 'Sun'] ?? 0
}

export function shouldSendToday(
  recurrenceType: string,
  recurrenceDays: number[] | null,
  dayOfWeek: number,
): boolean {
  if (recurrenceType === 'daily') return true
  if (recurrenceType === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
  if (recurrenceType === 'custom' && recurrenceDays) return recurrenceDays.includes(dayOfWeek)
  return true
}
