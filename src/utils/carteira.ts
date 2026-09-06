import type { AssetWithQuote } from '../types'

export interface TotalCarteira {
  total: number
  /** Posições que existem mas ficaram fora da soma por falta de cotação. */
  semCotacao: number
}

/**
 * Valor atual da carteira. Só entra quem tem posição (`quantity > 0`): ativo
 * apenas vigiado não tem valor a somar, e a falta de cotação nele não é uma
 * ausência que valha avisar — não há dinheiro parado ali.
 */
export function totalCarteira(ativos: AssetWithQuote[]): TotalCarteira {
  return ativos.reduce<TotalCarteira>(
    (acc, a) => {
      if (a.quantity <= 0) return acc
      if (a.current_value === null) return { ...acc, semCotacao: acc.semCotacao + 1 }
      return { ...acc, total: acc.total + a.current_value }
    },
    { total: 0, semCotacao: 0 },
  )
}
