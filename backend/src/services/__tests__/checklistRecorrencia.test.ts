import { shouldSendToday, getDayOfWeekSaoPaulo } from '../checklistRecurrence'

// Datas em UTC para o teste não depender do relógio da máquina.
const emUtc = (iso: string) => new Date(iso)

describe('getDayOfWeekSaoPaulo', () => {
  it('usa o dia da semana de São Paulo, não o do processo em UTC', () => {
    // Sexta 21h BRT já é sábado em UTC — era aqui que a recorrência errava.
    expect(getDayOfWeekSaoPaulo(emUtc('2026-09-05T00:00:00Z'))).toBe(5)
    expect(new Date('2026-09-05T00:00:00Z').getUTCDay()).toBe(6)
  })

  it('acerta um horário no meio do dia', () => {
    expect(getDayOfWeekSaoPaulo(emUtc('2026-09-02T15:00:00Z'))).toBe(3)
  })
})

describe('shouldSendToday', () => {
  it('daily envia todo dia', () => {
    for (let dia = 0; dia <= 6; dia++) {
      expect(shouldSendToday('daily', null, dia)).toBe(true)
    }
  })

  it('weekdays envia de segunda a sexta', () => {
    expect(shouldSendToday('weekdays', null, 0)).toBe(false)
    expect(shouldSendToday('weekdays', null, 1)).toBe(true)
    expect(shouldSendToday('weekdays', null, 5)).toBe(true)
    expect(shouldSendToday('weekdays', null, 6)).toBe(false)
  })

  it('custom envia só nos dias escolhidos', () => {
    expect(shouldSendToday('custom', [1, 3, 5], 3)).toBe(true)
    expect(shouldSendToday('custom', [1, 3, 5], 2)).toBe(false)
  })

  it('custom sem dias definidos cai no padrão de enviar', () => {
    expect(shouldSendToday('custom', null, 2)).toBe(true)
  })
})
