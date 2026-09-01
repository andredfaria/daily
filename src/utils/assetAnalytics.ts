import type { AssetKind, AssetWithQuote } from '../types'

export interface PosicaoAgregada {
  patrimonio: number
  investido: number
  resultado: number
  resultadoPct: number
  comPosicao: number
  watchlist: number
  semCotacao: number
}

export interface FatiaAlocacao {
  kind: AssetKind
  valor: number
  pct: number
}

export interface ResultadoAtivo {
  ticker: string
  resultado: number
  resultadoPct: number
}

const ORDEM_TIPOS: AssetKind[] = ['stock', 'fii', 'crypto']

const ROTULOS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

export function rotuloTipo(kind: AssetKind): string {
  return ROTULOS[kind]
}

// Quantidade zero é watchlist, não posição — a mesma regra que o alerta aplica
// em buildHitBlock. Cotação ausente também fica de fora: somar o valor
// investido no lugar do atual inventaria um patrimônio que não existe.
function temPosicaoAvaliada(a: AssetWithQuote): boolean {
  return a.quantity > 0 && a.current_value !== null
}

export function agregarPosicao(ativos: AssetWithQuote[]): PosicaoAgregada {
  const base: PosicaoAgregada = {
    patrimonio: 0, investido: 0, resultado: 0, resultadoPct: 0,
    comPosicao: 0, watchlist: 0, semCotacao: 0,
  }

  const agregado = ativos.reduce((acc, a) => {
    if (a.quantity <= 0) {
      acc.watchlist += 1
      return acc
    }
    if (a.current_value === null) {
      acc.semCotacao += 1
      return acc
    }
    acc.patrimonio += a.current_value
    acc.investido += a.invested_value
    acc.resultado += a.profit_loss ?? 0
    acc.comPosicao += 1
    return acc
  }, base)

  // Investido zero é posição sem custo registrado — não há percentual a calcular.
  agregado.resultadoPct = agregado.investido > 0
    ? (agregado.resultado / agregado.investido) * 100
    : 0

  return agregado
}

export function alocacaoPorTipo(ativos: AssetWithQuote[]): FatiaAlocacao[] {
  const avaliados = ativos.filter(temPosicaoAvaliada)
  const total = avaliados.reduce((s, a) => s + (a.current_value ?? 0), 0)
  if (total <= 0) return []

  return ORDEM_TIPOS.map((kind) => {
    const valor = avaliados
      .filter((a) => a.kind === kind)
      .reduce((s, a) => s + (a.current_value ?? 0), 0)
    return { kind, valor, pct: (valor / total) * 100 }
  }).filter((f) => f.valor > 0)
}

export function resultadoPorAtivo(ativos: AssetWithQuote[]): ResultadoAtivo[] {
  return ativos
    .filter(temPosicaoAvaliada)
    .map((a) => ({
      ticker: a.ticker,
      resultado: a.profit_loss ?? 0,
      resultadoPct: a.profit_loss_pct ?? 0,
    }))
    .sort((x, y) => y.resultadoPct - x.resultadoPct)
}

// Posição do preço atual entre o stop e o alvo, de 0 a 100. Sem os dois limites
// não há régua a desenhar — a tela mostra o outro formato nesse caso.
export function progressoAlvoStop(ativo: AssetWithQuote): number | null {
  const preco = ativo.current_price
  const stop = ativo.stop_price
  const alvo = ativo.target_price

  if (preco === null || stop === null || alvo === null) return null
  if (alvo <= stop) return null

  const pct = ((preco - stop) / (alvo - stop)) * 100
  return Math.max(0, Math.min(100, pct))
}
