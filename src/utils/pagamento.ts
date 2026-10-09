/**
 * Regras puras do pagamento de conta (marcar como paga).
 */

/**
 * Dia e mês (DD/MM) em que a conta foi paga, no fuso de São Paulo.
 *
 * O `paid_at` chega como ISO com fuso (`2026-10-05T13:00:00.000Z`, serialização
 * do DATETIME pelo mysql2) e é convertido para São Paulo — sem isso, pagamento
 * feito às 22h BRT apareceria como do dia seguinte. Texto sem fuso
 * (`2026-10-05 10:00:00`) já é a data local e é usado como veio.
 */
export const diaDoPagamento = (paidAt: string): string => {
  const semFuso = /^(\d{4})-(\d{2})-(\d{2})(?:[ ]\d{2}:\d{2}(?::\d{2})?)?$/.exec(paidAt)
  if (semFuso) return `${semFuso[3]}/${semFuso[2]}`

  const data = new Date(paidAt)
  if (Number.isNaN(data.getTime())) return ''
  const partes = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
  }).formatToParts(data)
  const dia = partes.find((p) => p.type === 'day')?.value ?? ''
  const mes = partes.find((p) => p.type === 'month')?.value ?? ''
  return `${dia}/${mes}`
}

/** Texto do selo da conta paga: "Paga em 05/10" (ou só "Paga" se a data não vier legível). */
export const rotuloPaga = (paidAt: string): string => {
  const dia = diaDoPagamento(paidAt)
  return dia ? `Paga em ${dia}` : 'Paga'
}

/**
 * Valor que vem preenchido ao pagar a conta variável: o real do mês se já foi
 * informado, senão a estimativa da conta.
 */
export const valorSugeridoDoPagamento = (
  ocorrencia: { amount: number | string; amount_is_actual: boolean | number },
  estimativa: number | string,
): number => Number(Number(ocorrencia.amount_is_actual) ? ocorrencia.amount : estimativa)
