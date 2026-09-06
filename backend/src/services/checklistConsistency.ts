// Contrato compartilhado com o frontend (Task 2 redeclara os mesmos nomes em
// src/types/index.ts) — qualquer mudança de forma aqui quebra a integração.
export interface JanelaConstancia {
  dias_com_poll: number      // denominador: polls enviados na janela
  dias_respondidos: number   // completed_count > 0
  dias_completos: number     // completion_pct >= 100
}

export interface ComparativoConstancia {
  atual: JanelaConstancia
  anterior: JanelaConstancia
}

export interface ConstanciaChecklist {
  semana: ComparativoConstancia
  mes: ComparativoConstancia
  sequencia: { atual: number; melhor: number }
}

export interface PollResumo {
  poll_date: string        // 'YYYY-MM-DD'
  completed_count: number
  completion_pct: number
}

function janelaZerada(): JanelaConstancia {
  return { dias_com_poll: 0, dias_respondidos: 0, dias_completos: 0 }
}

// Único lugar que escreve o literal zerado — rota e módulo reaproveitam.
export function constanciaZerada(): ConstanciaChecklist {
  return {
    semana: { atual: janelaZerada(), anterior: janelaZerada() },
    mes: { atual: janelaZerada(), anterior: janelaZerada() },
    sequencia: { atual: 0, melhor: 0 },
  }
}

// Aritmética em UTC só para navegar dias a partir da string 'YYYY-MM-DD' —
// não representa hora nenhuma, então o fuso do processo não interfere.
function somarDias(dataISO: string, delta: number): string {
  const [ano, mes, dia] = dataISO.split('-').map(Number)
  const data = new Date(Date.UTC(ano, mes - 1, dia))
  data.setUTCDate(data.getUTCDate() + delta)
  return data.toISOString().slice(0, 10)
}

// Strings 'YYYY-MM-DD' comparam corretamente com operador de string, então a
// janela é só um filtro por intervalo inclusivo nas duas pontas.
function calcularJanela(polls: PollResumo[], inicio: string, fim: string): JanelaConstancia {
  const doPeriodo = polls.filter((p) => p.poll_date >= inicio && p.poll_date <= fim)
  return {
    dias_com_poll: doPeriodo.length,
    dias_respondidos: doPeriodo.filter((p) => Number(p.completed_count) > 0).length,
    dias_completos: doPeriodo.filter((p) => Number(p.completion_pct) >= 100).length,
  }
}

function calcularComparativo(polls: PollResumo[], hoje: string, tamanhoDias: number): ComparativoConstancia {
  const atualInicio = somarDias(hoje, -(tamanhoDias - 1))
  const anteriorFim = somarDias(atualInicio, -1)
  const anteriorInicio = somarDias(anteriorFim, -(tamanhoDias - 1))
  return {
    atual: calcularJanela(polls, atualInicio, hoje),
    anterior: calcularJanela(polls, anteriorInicio, anteriorFim),
  }
}

// Poll de hoje ainda sem resposta não deve contar como quebra: o dia não
// acabou. Ele só entra na contagem quando alguém já respondeu algo.
function descartarPollDeHojeNaoRespondido(polls: PollResumo[], hoje: string): PollResumo[] {
  const ultimo = polls[polls.length - 1]
  if (ultimo && ultimo.poll_date === hoje && Number(ultimo.completed_count) === 0) {
    return polls.slice(0, -1)
  }
  return polls
}

function calcularSequenciaAtual(polls: PollResumo[]): number {
  let atual = 0
  for (let i = polls.length - 1; i >= 0; i -= 1) {
    if (Number(polls[i].completed_count) > 0) {
      atual += 1
    } else {
      break
    }
  }
  return atual
}

function calcularMelhorSequencia(polls: PollResumo[]): number {
  let melhor = 0
  let corrida = 0
  for (const poll of polls) {
    if (Number(poll.completed_count) > 0) {
      corrida += 1
      melhor = Math.max(melhor, corrida)
    } else {
      corrida = 0
    }
  }
  return melhor
}

export function computeConsistency(
  polls: PollResumo[],   // só polls despachados, ordem cronológica crescente
  hoje: string,          // 'YYYY-MM-DD' em São Paulo
): ConstanciaChecklist {
  if (polls.length === 0) return constanciaZerada()

  const paraSequencia = descartarPollDeHojeNaoRespondido(polls, hoje)

  return {
    semana: calcularComparativo(polls, hoje, 7),
    mes: calcularComparativo(polls, hoje, 30),
    sequencia: {
      atual: calcularSequenciaAtual(paraSequencia),
      melhor: calcularMelhorSequencia(paraSequencia),
    },
  }
}
