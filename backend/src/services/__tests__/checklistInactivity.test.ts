import { nextMissState } from '../checklistInactivity'

describe('nextMissState', () => {
  it('reseta para 0 quando o último poll teve alguma resposta', () => {
    expect(nextMissState(14, 1)).toEqual({ misses: 0, shouldLock: false })
    expect(nextMissState(20, 2)).toEqual({ misses: 0, shouldLock: false })
  })

  it('incrementa em 1 quando o último poll teve zero respostas', () => {
    expect(nextMissState(0, 0)).toEqual({ misses: 1, shouldLock: false })
    expect(nextMissState(5, 0)).toEqual({ misses: 6, shouldLock: false })
  })

  it('shouldLock é false um dia antes do limiar padrão (15)', () => {
    expect(nextMissState(13, 0)).toEqual({ misses: 14, shouldLock: false })
  })

  it('shouldLock é true exatamente no limiar padrão (15)', () => {
    expect(nextMissState(14, 0)).toEqual({ misses: 15, shouldLock: true })
  })

  it('respeita um threshold customizado', () => {
    expect(nextMissState(1, 0, 3)).toEqual({ misses: 2, shouldLock: false })
    expect(nextMissState(2, 0, 3)).toEqual({ misses: 3, shouldLock: true })
  })
})
