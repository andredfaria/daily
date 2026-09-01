import {
  nextMissState,
  buildInactivityMessage,
  INACTIVITY_THRESHOLD,
} from '../checklistInactivity'

describe('nextMissState', () => {
  it('reseta para 0 quando o último poll teve alguma resposta', () => {
    expect(nextMissState(14, 1)).toEqual({ misses: 0, shouldLock: false })
    expect(nextMissState(20, 2)).toEqual({ misses: 0, shouldLock: false })
  })

  it('incrementa em 1 quando o último poll teve zero respostas', () => {
    expect(nextMissState(0, 0)).toEqual({ misses: 1, shouldLock: false })
    expect(nextMissState(1, 0)).toEqual({ misses: 2, shouldLock: false })
  })

  it('shouldLock é false um dia antes do limiar padrão (3)', () => {
    expect(nextMissState(1, 0)).toEqual({ misses: 2, shouldLock: false })
  })

  it('shouldLock é true exatamente no limiar padrão (3)', () => {
    expect(nextMissState(2, 0)).toEqual({ misses: 3, shouldLock: true })
  })

  it('respeita um threshold customizado', () => {
    expect(nextMissState(13, 0, 15)).toEqual({ misses: 14, shouldLock: false })
    expect(nextMissState(14, 0, 15)).toEqual({ misses: 15, shouldLock: true })
  })
})

describe('INACTIVITY_THRESHOLD', () => {
  it('é 3 dias', () => {
    expect(INACTIVITY_THRESHOLD).toBe(3)
  })
})

describe('buildInactivityMessage', () => {
  it('nomeia o checklist pausado', () => {
    expect(buildInactivityMessage('Rotina da manhã')).toContain('*Rotina da manhã*')
  })

  it('usa o limiar em vigor em vez de um número cravado no texto', () => {
    expect(buildInactivityMessage('X', 7)).toContain('7 dias')
    expect(buildInactivityMessage('X')).toContain(`${INACTIVITY_THRESHOLD} dias`)
  })

  it('deixa claro que os lembretes de contas continuam', () => {
    const msg = buildInactivityMessage('X')
    expect(msg).toMatch(/contas continuam/i)
  })

  it('diz onde reativar', () => {
    expect(buildInactivityMessage('X')).toMatch(/reative em Checklists/i)
  })

  it('não promete pausar contas, como o texto antigo fazia', () => {
    expect(buildInactivityMessage('X')).not.toMatch(/pausamos os lembretes por WhatsApp/i)
  })
})
