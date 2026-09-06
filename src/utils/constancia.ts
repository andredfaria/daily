export interface DeltaFormatado {
  texto: string                              // '+2', '−1', '0'  (menos é U+2212)
  direcao: 'subiu' | 'desceu' | 'igual'
}

// U+2212 (sinal de menos matemático) em vez do hífen ASCII '-': mesmo cuidado
// tipográfico usado no resto do app para números negativos.
export function formatarDelta(atual: number, anterior: number): DeltaFormatado {
  const diferenca = atual - anterior
  if (diferenca > 0) return { texto: `+${diferenca}`, direcao: 'subiu' }
  if (diferenca < 0) return { texto: `−${Math.abs(diferenca)}`, direcao: 'desceu' }
  return { texto: '0', direcao: 'igual' }
}
