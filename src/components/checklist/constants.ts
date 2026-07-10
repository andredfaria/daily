import type { ChecklistRecurrenceType } from '../../types'

export const RECURRENCE_LABELS: Record<ChecklistRecurrenceType, string> = {
  daily: 'Todos os dias',
  weekdays: 'Dias úteis (Seg–Sex)',
  custom: 'Personalizado',
}

export const DAYS_LABELS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
