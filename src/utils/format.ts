import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'

export const formatBRL = (value: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

export const formatDate = (date: string | Date, pattern = 'dd/MM/yyyy'): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, pattern, { locale: ptBR })
}

export const formatDateFull = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, "d 'de' MMMM 'de' yyyy", { locale: ptBR })
}

export const formatMonthYear = (date: string | Date): string => {
  const d = typeof date === 'string' ? parseISO(date) : date
  return format(d, 'MMMM yyyy', { locale: ptBR })
}

export const formatRelativeDate = (
  date: string | Date,
): { label: string; color: string } => {
  const d = typeof date === 'string' ? parseISO(date) : date

  if (isToday(d)) return { label: 'Hoje', color: 'text-error' }
  if (isTomorrow(d)) return { label: 'Amanhã', color: 'text-primary' }
  if (isPast(d)) return { label: 'Atrasado', color: 'text-error' }

  const distance = formatDistanceToNow(d, { locale: ptBR, addSuffix: false })
  return { label: `Em ${distance}`, color: 'text-on-surface-variant' }
}

export const getBillIcon = (name: string): string => {
  const lower = name.toLowerCase()
  if (/home|aluguel|condomínio|condo/.test(lower)) return 'home'
  if (/energia|luz|enel|cpfl|cemig|coelba/.test(lower)) return 'bolt'
  if (/internet|fibra|vivo|tim|claro|oi|banda/.test(lower)) return 'wifi'
  if (/academia|gym|smartfit|fitness/.test(lower)) return 'fitness_center'
  if (/cartão|card|credit|nubank|itaú|bradesco/.test(lower)) return 'credit_card'
  if (/água|water|sabesp|saneago/.test(lower)) return 'water_drop'
  if (/gás|gas|comgás/.test(lower)) return 'local_fire_department'
  if (/seguro|insurance/.test(lower)) return 'shield'
  if (/streaming|netflix|spotify|youtube|disney|hbo|prime/.test(lower)) return 'play_circle'
  if (/telefone|phone|celular|móvel/.test(lower)) return 'phone'
  if (/escola|faculdade|universidade|mensalidade/.test(lower)) return 'school'
  if (/saúde|plano|health|médico/.test(lower)) return 'medical_services'
  if (/transporte|uber|99|ifood/.test(lower)) return 'directions_car'
  return 'receipt_long'
}

export const getRecurrenceLabel = (type: string, day?: number, weekday?: number): string => {
  if (type === 'monthly') return day ? `Todo dia ${day}` : 'Mensal'
  if (type === 'weekly') {
    const days = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
    return weekday !== undefined ? `Toda ${days[weekday]}` : 'Semanal'
  }
  return 'Avulso'
}

export const getRecurrenceBadgeColor = (type: string): string => {
  if (type === 'monthly') return 'bg-primary/20 text-primary'
  if (type === 'weekly') return 'bg-secondary-container text-on-secondary-container'
  return 'bg-surface-variant text-on-surface-variant'
}

export const getRecurrenceShortLabel = (type: string): string => {
  if (type === 'monthly') return 'MENSAL'
  if (type === 'weekly') return 'SEMANAL'
  return 'AVULSO'
}
