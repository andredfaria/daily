export type ClassificacaoItem = 'sem_dados' | 'fraco' | 'oscilando' | 'firme'

// Sequência abaixo disso não vira selo: dois dias seguidos é acaso, e uma chama
// em toda linha tira a atenção de quem está realmente embalado.
export const STREAK_MINIMO_EXIBIDO = 3

/**
 * Traduz a taxa de conclusão de 30 dias de um item numa leitura rápida.
 * `totalPolls` manda sobre a faixa: item novo, que ainda não entrou em nenhum
 * poll, tem pct 0 e não pode ser acusado de fraco por isso.
 */
export function classificarItem(pct: number, totalPolls: number): ClassificacaoItem {
  if (totalPolls === 0) return 'sem_dados'
  if (pct < 50) return 'fraco'
  if (pct < 80) return 'oscilando'
  return 'firme'
}
