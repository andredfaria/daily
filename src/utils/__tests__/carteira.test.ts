import { describe, it, expect } from 'vitest'
import { totalCarteira } from '../carteira'

// current_value é null quando o provedor não devolveu cotação, e 0 quando o
// ativo é só vigiado (quantidade zerada). Os dois ficam fora da soma, mas só o
// primeiro é uma ausência que o usuário precisa saber.
const ativo = (current_value: number | null, quantity = 1) =>
  ({ current_value, quantity }) as any

describe('totalCarteira', () => {
  it('soma o valor atual das posições cotadas', () => {
    expect(totalCarteira([ativo(1000), ativo(480.3)])).toEqual({ total: 1480.3, semCotacao: 0 })
  })

  it('conta quem ficou de fora por falta de cotação', () => {
    expect(totalCarteira([ativo(1000), ativo(null), ativo(null)])).toEqual({
      total: 1000,
      semCotacao: 2,
    })
  })

  it('ativo só vigiado (quantidade 0) não entra na soma nem no aviso', () => {
    // Sem posição não há valor a somar, e não ter cotação ali não é uma falha
    // que valha avisar — o usuário não comprou nada.
    expect(totalCarteira([ativo(1000), ativo(null, 0), ativo(0, 0)])).toEqual({
      total: 1000,
      semCotacao: 0,
    })
  })

  it('carteira vazia devolve zero sem lançar', () => {
    expect(totalCarteira([])).toEqual({ total: 0, semCotacao: 0 })
  })

  it('carteira inteira sem cotação devolve total zero e conta todas', () => {
    expect(totalCarteira([ativo(null), ativo(null)])).toEqual({ total: 0, semCotacao: 2 })
  })
})
