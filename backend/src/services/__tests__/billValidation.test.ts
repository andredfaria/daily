import { validarConta, RECURRENCE_TYPES } from '../billValidation'

// Uma conta mensal válida — cada teste muda só o campo que está em julgamento.
const mensal = {
  name: 'Luz',
  amount: 180.5,
  recurrence_type: 'monthly',
  recurrence_day_of_month: 10,
  days_before_alert: 3,
}

describe('validarConta', () => {
  it('aceita uma conta mensal completa', () => {
    expect(validarConta(mensal)).toBeNull()
  })

  describe('nome', () => {
    it('recusa nome ausente', () => {
      expect(validarConta({ ...mensal, name: undefined })).toBe('Campo obrigatório: name')
    })

    it('recusa nome só com espaço', () => {
      expect(validarConta({ ...mensal, name: '   ' })).toBe('Campo obrigatório: name')
    })
  })

  describe('valor', () => {
    it('aceita zero', () => {
      expect(validarConta({ ...mensal, amount: 0 })).toBeNull()
    })

    it('recusa valor negativo', () => {
      expect(validarConta({ ...mensal, amount: -1 })).toMatch(/amount/)
    })

    // "1e400" vira Infinity e estoura a coluna DECIMAL(10,2) no INSERT, mas passa
    // no isNaN — o motivo de a checagem ser Number.isFinite.
    it('recusa notação que vira Infinity', () => {
      expect(validarConta({ ...mensal, amount: '1e400' })).toMatch(/amount/)
    })

    it('recusa texto', () => {
      expect(validarConta({ ...mensal, amount: 'abc' })).toMatch(/amount/)
    })
  })

  describe('tipo de recorrência', () => {
    it('recusa um tipo que a coluna não tem', () => {
      expect(validarConta({ ...mensal, recurrence_type: 'daily' })).toMatch(/recurrence_type/)
    })

    it('recusa tipo ausente', () => {
      expect(validarConta({ ...mensal, recurrence_type: undefined })).toMatch(/recurrence_type/)
    })

    // Trava contra o descompasso que existia: a tela oferecia trimestral, o
    // gerador de ocorrências tratava, e a validação não conhecia o tipo.
    it('conhece os sete tipos que o occurrenceGenerator trata', () => {
      expect([...RECURRENCE_TYPES].sort()).toEqual(
        ['annual', 'biweekly', 'monthly', 'once', 'quarterly', 'semiannual', 'weekly']
      )
    })
  })

  describe('campo exigido por recorrência', () => {
    it.each(['monthly', 'quarterly', 'semiannual', 'annual'])(
      '%s exige dia do mês',
      (tipo) => {
        const erro = validarConta({ ...mensal, recurrence_type: tipo, recurrence_day_of_month: null })
        expect(erro).toBe(`recurrence_day_of_month é obrigatório para recorrência ${tipo}`)
      }
    )

    it.each(['weekly', 'biweekly'])('%s exige dia da semana', (tipo) => {
      const erro = validarConta({
        ...mensal,
        recurrence_type: tipo,
        recurrence_day_of_month: null,
        recurrence_day_of_week: null,
      })
      expect(erro).toBe(`recurrence_day_of_week é obrigatório para recorrência ${tipo}`)
    })

    it('once exige due_date', () => {
      const erro = validarConta({
        ...mensal,
        recurrence_type: 'once',
        recurrence_day_of_month: null,
        due_date: null,
      })
      expect(erro).toBe('due_date é obrigatório para recorrência pontual')
    })

    it('once aceita due_date como Date (o que o MySQL devolve)', () => {
      const erro = validarConta({
        ...mensal,
        recurrence_type: 'once',
        recurrence_day_of_month: null,
        due_date: new Date('2026-10-01'),
      })
      expect(erro).toBeNull()
    })
  })

  describe('faixas numéricas', () => {
    it('recusa dia do mês fora de 1..31', () => {
      expect(validarConta({ ...mensal, recurrence_day_of_month: 99 })).toMatch(/day_of_month/)
      expect(validarConta({ ...mensal, recurrence_day_of_month: 0 })).toMatch(/day_of_month/)
    })

    it('recusa dia da semana fora de 0..6', () => {
      const semanal = { ...mensal, recurrence_type: 'weekly', recurrence_day_of_month: null }
      expect(validarConta({ ...semanal, recurrence_day_of_week: 7 })).toMatch(/day_of_week/)
      expect(validarConta({ ...semanal, recurrence_day_of_week: 0 })).toBeNull()
    })

    it('recusa days_before_alert fora de 0..30', () => {
      expect(validarConta({ ...mensal, days_before_alert: 31 })).toMatch(/days_before_alert/)
      expect(validarConta({ ...mensal, days_before_alert: -1 })).toMatch(/days_before_alert/)
      expect(validarConta({ ...mensal, days_before_alert: 0 })).toBeNull()
    })

    it('recusa dia fracionado', () => {
      expect(validarConta({ ...mensal, recurrence_day_of_month: 10.5 })).toMatch(/day_of_month/)
    })
  })

  describe('is_active', () => {
    it('aceita o 1/0 que o MySQL devolve no estado mesclado do PATCH', () => {
      expect(validarConta({ ...mensal, is_active: 1 })).toBeNull()
      expect(validarConta({ ...mensal, is_active: 0 })).toBeNull()
    })

    it('recusa string', () => {
      expect(validarConta({ ...mensal, is_active: 'sim' })).toBe('is_active deve ser booleano')
    })
  })

  // O PATCH valida o estado FINAL: a linha do banco mesclada com o corpo enviado.
  describe('estado mesclado do PATCH', () => {
    const doBanco = {
      name: 'Luz',
      amount: '180.50',        // DECIMAL volta como string do mysql2
      recurrence_type: 'monthly',
      recurrence_day_of_month: 10,
      recurrence_day_of_week: null,
      due_date: null,
      days_before_alert: 3,
      is_active: 1,
    }

    it('aceita a linha do banco sem alteração nenhuma', () => {
      expect(validarConta({ ...doBanco })).toBeNull()
    })

    it('recusa virar semanal sem informar o dia da semana', () => {
      const erro = validarConta({ ...doBanco, recurrence_type: 'weekly' })
      expect(erro).toBe('recurrence_day_of_week é obrigatório para recorrência weekly')
    })

    it('aceita virar semanal informando o dia da semana', () => {
      const erro = validarConta({ ...doBanco, recurrence_type: 'weekly', recurrence_day_of_week: 2 })
      expect(erro).toBeNull()
    })

    it('recusa zerar o valor para negativo por um patch parcial', () => {
      expect(validarConta({ ...doBanco, amount: -50 })).toMatch(/amount/)
    })

    it('recusa esvaziar o nome por um patch parcial', () => {
      expect(validarConta({ ...doBanco, name: '' })).toBe('Campo obrigatório: name')
    })
  })
})
