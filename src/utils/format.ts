import { format, formatDistanceToNow, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import type { NotificationEnriched } from '../types'

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
  if (type === 'biweekly') return 'Quinzenal'
  if (type === 'quarterly') return day ? `Trimestral (dia ${day})` : 'Trimestral'
  if (type === 'semiannual') return day ? `Semestral (dia ${day})` : 'Semestral'
  if (type === 'annual') return day ? `Anual (dia ${day})` : 'Anual'
  return 'Avulso'
}

export const getRecurrenceBadgeColor = (type: string): string => {
  if (type === 'monthly') return 'bg-primary/20 text-primary'
  if (type === 'weekly') return 'bg-secondary-container text-on-secondary-container'
  if (type === 'biweekly') return 'bg-secondary-container text-on-secondary-container'
  if (type === 'quarterly') return 'bg-tertiary/20 text-tertiary'
  if (type === 'semiannual') return 'bg-tertiary/20 text-tertiary'
  if (type === 'annual') return 'bg-tertiary/20 text-tertiary'
  return 'bg-surface-variant text-on-surface-variant'
}

export const getRecurrenceShortLabel = (type: string): string => {
  if (type === 'monthly') return 'MENSAL'
  if (type === 'weekly') return 'SEMANAL'
  if (type === 'biweekly') return 'QUINZENAL'
  if (type === 'quarterly') return 'TRIMESTRAL'
  if (type === 'semiannual') return 'SEMESTRAL'
  if (type === 'annual') return 'ANUAL'
  return 'AVULSO'
}

export const getCategoryLabel = (category?: string): string => {
  const labels: Record<string, string> = {
    moradia: 'Moradia',
    assinaturas: 'Assinaturas',
    'serviços': 'Serviços',
    'saúde': 'Saúde',
    'educação': 'Educação',
    transporte: 'Transporte',
    'alimentação': 'Alimentação',
    outro: 'Outro',
  }
  return category ? (labels[category] ?? category) : ''
}

export const buildMessagePreview = (notif: NotificationEnriched): string => {
  const dueDateStr = typeof notif.due_date === 'string'
    ? notif.due_date.slice(0, 10)
    : String(notif.due_date).slice(0, 10)
  const [y, m, d] = dueDateStr.split('-')
  const dueFmt = `${d}/${m}/${y}`

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDateStr)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  let relative: string
  if (diffDays === 0) relative = 'hoje'
  else if (diffDays === 1) relative = 'amanhã'
  else if (diffDays > 1) relative = `em ${diffDays} dias`
  else if (diffDays === -1) relative = 'venceu ontem'
  else relative = `venceu há ${Math.abs(diffDays)} dias`

  const amount = Number(notif.amount).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

  let paymentSection = ''
  if (notif.pm_type === 'pix') {
    const keyTypeLabel: Record<string, string> = {
      cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
    }
    const label = notif.pix_key_type ? (keyTypeLabel[notif.pix_key_type] ?? notif.pix_key_type) : ''
    const beneficiary = notif.pix_beneficiary ? `\nFavorecido: ${notif.pix_beneficiary}` : ''
    paymentSection = `\n\n💳 *Pagamento:*\nPIX — ${label}: ${notif.pix_key}${beneficiary}`
  } else if (notif.pm_type === 'boleto') {
    paymentSection = `\n\n💳 *Pagamento:*\nBoleto:\n${notif.boleto_code}`
  }

  return `📅 *Lembrete de Vencimento — BillSync*\n\nConta: *${notif.bill_name}*\nValor: R$ ${amount}\nVencimento: *${relative} (${dueFmt})*${paymentSection}`
}
