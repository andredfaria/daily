import type { StatusAtividade } from '../types'



const MIN = 60_000
const H = 60 * MIN
const D = 24 * H

// "há 5 min", "há 2 h", "há 3 dias"; passado de 30 dias vira dd/mm/aaaa (São Paulo).
export function tempoRelativo(iso: string, agora: Date = new Date()): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return '—'
  const diff = agora.getTime() - t
  if (diff < MIN) return 'agora'
  if (diff < H) return `há ${Math.floor(diff / MIN)} min`
  if (diff < D) return `há ${Math.floor(diff / H)} h`
  const dias = Math.floor(diff / D)
  if (dias <= 30) return `há ${dias} ${dias === 1 ? 'dia' : 'dias'}`
  return new Date(t).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })
}

const KINDS: Record<string, string> = {
  login: 'Entrou',
  login_falha: 'Falha no login',
  otp_pedido: 'Pediu código',
  logout: 'Saiu',
  acesso: 'Acessou o app',
  comando: 'Comando do WhatsApp',
  erro_api: 'Erro de API',
}

const MSG_REFS: Record<string, string> = {
  lembrete_conta: 'Lembrete de conta',
  enquete: 'Enquete do checklist',
  resumo_semanal: 'Resumo semanal',
  resumo_mensal: 'Resumo mensal',
  alerta_ativo: 'Alerta de ativo',
  alerta_orcamento: 'Alerta de orçamento',
  resposta_comando: 'Resposta de comando',
  otp: 'Código de acesso',
  apology: 'Pedido de desculpas',
  reenvio: 'Reenvio',
  desconhecido: 'Mensagem',
}

export function rotuloAtividade(kind: string, ref: string | null): string {
  if (kind === 'msg_enviada') {
    if (!ref) return 'Mensagem enviada'
    return MSG_REFS[ref] ?? ref
  }
  if (kind === 'erro_tick') return ref ? `Erro do agendador (${ref})` : 'Erro do agendador'
  return KINDS[kind] ?? kind
}

export function corStatus(status: StatusAtividade | string): 'ok' | 'erro' | 'aviso' {
  if (status === 'ok') return 'ok'
  if (status === 'falha') return 'erro'
  return 'aviso'
}
