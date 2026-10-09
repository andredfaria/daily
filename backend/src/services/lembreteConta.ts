// Parte pura do lembrete de vencimento: texto da mensagem e a decisão de pular.
// O envio e o banco ficam em dispatcher.ts.

function formatAmount(amount: number): string {
  return Number(amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// hoje: data de São Paulo (YYYY-MM-DD).
export function buildRelativeDate(dueDate: string, hoje: string): string {
  const today = new Date(hoje + 'T00:00:00')
  const due = new Date(dueDate + 'T00:00:00')
  const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return 'hoje'
  if (diffDays === 1) return 'amanhã'
  if (diffDays > 1) return `em ${diffDays} dias`
  if (diffDays === -1) return 'venceu ontem'
  return `venceu há ${Math.abs(diffDays)} dias`
}

export function buildPaymentSection(pm: any): string {
  if (!pm) return ''
  if (pm.type === 'pix') {
    const keyTypeLabel: Record<string, string> = {
      cpf: 'CPF', email: 'E-mail', phone: 'Telefone', random: 'Chave aleatória',
    }
    const label = keyTypeLabel[pm.pix_key_type] ?? pm.pix_key_type
    const beneficiary = pm.pix_beneficiary ? `\nFavorecido: ${pm.pix_beneficiary}` : ''
    return `\n💳 *Pagamento:*\nPIX — ${label}: ${pm.pix_key}${beneficiary}`
  }
  if (pm.type === 'boleto') {
    return `\n💳 *Pagamento:*\nBoleto:\n${pm.boleto_code}`
  }
  return ''
}

// estimado: conta variável cujo valor real do mês ainda não foi informado.
// A última linha convida a marcar a conta como paga pelo próprio WhatsApp.
export function buildMessage(
  billName: string, amount: number, dueDate: string, pm: any, estimado: boolean, hoje: string,
): string {
  const [y, m, d] = dueDate.split('-')
  const dueFmt = `${d}/${m}/${y}`
  const relative = buildRelativeDate(dueDate, hoje)
  const paymentSection = buildPaymentSection(pm)

  return (
    `📅 *Lembrete de Vencimento — Rotina*\n\n` +
    `Conta: *${billName}*\n` +
    (estimado
      ? `Valor estimado: R$ ${formatAmount(amount)}\n`
      : `Valor: R$ ${formatAmount(amount)}\n`) +
    `Vencimento: *${relative} (${dueFmt})*` +
    paymentSection +
    `\n\nJá pagou? Responda /paguei ${billName}`
  )
}

// Lembrete na fila que não deve sair: conta desativada ou vencimento já pago.
// A ocorrência pode ter sido paga depois que o lembrete foi materializado.
export function lembreteDevePular(n: { bill_is_active: unknown; paid_at: unknown }): boolean {
  if (!n.bill_is_active) return true
  return n.paid_at !== null && n.paid_at !== undefined
}
