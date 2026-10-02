import { chaveDoTick, horaSaoPaulo } from '../schedulerTick'

describe('chaveDoTick', () => {
  it('usa data e hora de São Paulo, não as do processo em UTC', () => {
    // 01h UTC de sábado ainda é sexta 22h em São Paulo.
    expect(chaveDoTick(new Date('2026-09-05T01:00:00Z'))).toEqual({ chave: '2026-09-04 22', hora: 22 })
  })

  it('preenche a hora com zero à esquerda', () => {
    expect(chaveDoTick(new Date('2026-10-02T12:30:00Z')).chave).toBe('2026-10-02 09')
  })

  it('meia-noite vira hora 0, não 24', () => {
    expect(horaSaoPaulo(new Date('2026-10-02T03:00:00Z'))).toBe(0)
    expect(chaveDoTick(new Date('2026-10-02T03:00:00Z')).chave).toBe('2026-10-02 00')
  })

  it('minutos diferentes da mesma hora caem na mesma chave', () => {
    const cron = chaveDoTick(new Date('2026-10-02T13:00:00Z'))
    const boot = chaveDoTick(new Date('2026-10-02T13:47:12Z'))
    expect(boot.chave).toBe(cron.chave)
  })
})
