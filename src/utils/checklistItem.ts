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

/**
 * Quebra uma lista colada em itens: uma linha por item, sem o marcador que
 * vem junto do bloco de notas ou do WhatsApp ("- ", "• ", "1. ", "[ ] ", "☐ ").
 * Linhas vazias e repetidas caem fora — o formulário recusa duplicata.
 */
export function separarItensColados(texto: string): string[] {
  const vistos = new Set<string>()
  return String(texto ?? '')
    .split(/\r?\n/)
    .map((linha) => linha.replace(/^\s*(?:[-*•·–—]|\d+[.)]|\[[ xX]?\]|[☐☑✅✔])\s*/, '').trim())
    .filter((linha) => {
      const chave = linha.toLowerCase()
      if (!linha || vistos.has(chave)) return false
      vistos.add(chave)
      return true
    })
}
