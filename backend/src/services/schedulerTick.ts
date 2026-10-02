import { formatDateSaoPaulo } from './assetMath'

export function horaSaoPaulo(agora: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Sao_Paulo',
    hour: 'numeric',
    hour12: false,
  }).formatToParts(agora)
  const hourPart = parts.find(p => p.type === 'hour')
  return parseInt(hourPart?.value ?? '0', 10) % 24
}

// Identifica o tick horário em São Paulo ("2026-10-02 10"). É a chave da
// scheduler_ticks: o tick do cron e o de recuperação no boot disputam a mesma
// linha, e só quem a insere roda.
export function chaveDoTick(agora = new Date()): { chave: string; hora: number } {
  const hora = horaSaoPaulo(agora)
  return { chave: `${formatDateSaoPaulo(agora)} ${String(hora).padStart(2, '0')}`, hora }
}
