import { describe, it, expect } from 'vitest'
import { tempoRelativo, rotuloAtividade, corStatus } from '../atividade'

const agora = new Date('2026-11-19T12:00:00.000Z')
const antes = (ms: number) => new Date(agora.getTime() - ms).toISOString()
const MIN = 60_000
const H = 60 * MIN
const D = 24 * H

describe('tempoRelativo', () => {
  it('agora com menos de 1 min', () => expect(tempoRelativo(antes(30_000), agora)).toBe('agora'))
  it('minutos', () => expect(tempoRelativo(antes(5 * MIN), agora)).toBe('há 5 min'))
  it('horas', () => expect(tempoRelativo(antes(2 * H), agora)).toBe('há 2 h'))
  it('dias', () => expect(tempoRelativo(antes(3 * D), agora)).toBe('há 3 dias'))
  it('1 dia no singular', () => expect(tempoRelativo(antes(D), agora)).toBe('há 1 dia'))
  it('mais de 30 dias vira data', () => expect(tempoRelativo('2026-10-10T15:00:00.000Z', agora)).toBe('10/10/2026'))
  it('data inválida vira traço', () => expect(tempoRelativo('xx', agora)).toBe('—'))
})

describe('rotuloAtividade', () => {
  it('login', () => expect(rotuloAtividade('login', null)).toBe('Entrou'))
  it('msg_enviada conhecida', () => expect(rotuloAtividade('msg_enviada', 'lembrete_conta')).toBe('Lembrete de conta'))
  it('msg_enviada desconhecida devolve o ref cru', () => expect(rotuloAtividade('msg_enviada', 'xyz')).toBe('xyz'))
  it('erro_api', () => expect(rotuloAtividade('erro_api', null)).toBe('Erro de API'))
  it('erro_tick mostra o bloco', () => expect(rotuloAtividade('erro_tick', 'alertas')).toBe('Erro do agendador (alertas)'))
})

describe('corStatus', () => {
  it('ok', () => expect(corStatus('ok')).toBe('ok'))
  it('falha', () => expect(corStatus('falha')).toBe('erro'))
  it('ignorado', () => expect(corStatus('ignorado')).toBe('aviso'))
})
