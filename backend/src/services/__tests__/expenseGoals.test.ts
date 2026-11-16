import { validarMeta } from '../expenseGoals'

const base = { name: 'Viagem', start_date: '2026-11-20', end_date: '2026-11-23', amount: 800 }

describe('validarMeta', () => {
  it('aceita e limpa os dados', () => {
    expect(validarMeta({ ...base, name: '  Viagem  ', amount: '799.999' })).toEqual({ ...base, amount: 800 })
  })

  it('aceita período de um dia só', () => {
    expect(validarMeta({ ...base, end_date: base.start_date })).not.toHaveProperty('erro')
  })

  it('aceita até 366 dias contando início e fim', () => {
    expect(validarMeta({ ...base, end_date: '2027-11-20' })).not.toHaveProperty('erro')
  })

  it.each([
    [{ name: '' }, 'nome'],
    [{ name: 'x'.repeat(61) }, '60'],
    [{ start_date: '2026-02-30' }, 'formato'],
    [{ end_date: '20/11/2026' }, 'formato'],
    [{ end_date: '2026-11-19' }, 'antes'],
    [{ end_date: '2027-11-21' }, 'máximo'],
    [{ amount: 0 }, 'valor'],
    [{ amount: 'abc' }, 'valor'],
  ])('recusa %o', (troca: Record<string, unknown>, trecho: string) => {
    const r = validarMeta({ ...base, ...troca })
    expect('erro' in r && r.erro.toLowerCase()).toContain(trecho.toLowerCase())
  })
})
