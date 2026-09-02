import axios from 'axios'
import type { Quote } from './quotes'

/**
 * Cotação de criptomoeda pelo CoinGecko.
 *
 * Por que não a brapi: ela moveu criptomoedas para o plano pago e responde
 * `403 FEATURE_NOT_AVAILABLE` com token gratuito. O CoinGecko cobre milhares
 * de moedas, entrega preço em BRL nativo e não exige cadastro.
 */

const BASE_URL = 'https://api.coingecko.com/api/v3'

export interface MoedaCoinGecko {
  id?: string
  symbol?: string
  name?: string
  current_price?: number | string | null
  last_updated?: string | null
  market_cap_rank?: number | null
}

/**
 * Chave demo, gratuita em https://www.coingecko.com/en/api/pricing. Sobe o
 * limite de ~10 para 30 requisições/min. Opcional: sem ela a API pública
 * responde igual, só com menos folga.
 */
function coingeckoClient() {
  const chave = (process.env.COINGECKO_API_KEY ?? '').trim()
  return axios.create({
    baseURL: BASE_URL,
    headers: chave ? { 'x-cg-demo-api-key': chave } : {},
    timeout: 10000,
  })
}

const rankDe = (moeda: MoedaCoinGecko): number =>
  typeof moeda.market_cap_rank === 'number' ? moeda.market_cap_rank : Number.MAX_SAFE_INTEGER

/**
 * O filtro por símbolo pode devolver mais de uma moeda: símbolo não é único no
 * CoinGecko e projetos obscuros reaproveitam o de moedas conhecidas. Fica a de
 * maior capitalização (menor market_cap_rank), que é a que o usuário quis dizer
 * ao digitar "BTC".
 */
export function escolherMoeda(
  lista: MoedaCoinGecko[],
  symbol: string,
): MoedaCoinGecko | null {
  if (!Array.isArray(lista)) return null
  const alvo = symbol.trim().toLowerCase()

  const candidatas = lista.filter(
    (m) =>
      typeof m?.symbol === 'string' &&
      m.symbol.toLowerCase() === alvo &&
      Number.isFinite(Number(m.current_price)) &&
      Number(m.current_price) > 0,
  )
  if (candidatas.length === 0) return null

  return candidatas.reduce((melhor, atual) => (rankDe(atual) < rankDe(melhor) ? atual : melhor))
}

/** Data da cotação; ausente ou impossível de parsear vira "agora". */
function parseAtualizadoEm(raw: unknown): Date {
  if (typeof raw === 'string') {
    const d = new Date(raw)
    if (!Number.isNaN(d.getTime())) return d
  }
  return new Date()
}

/**
 * Busca a cotação em BRL. Devolve null quando o símbolo não existe; erros de
 * rede e HTTP (incluindo o 429 do limite gratuito) sobem para quem chamou
 * decidir o que fazer.
 */
export async function fetchCryptoQuote(symbol: string): Promise<Quote | null> {
  const alvo = symbol.trim().toUpperCase()

  const { data } = await coingeckoClient().get('/coins/markets', {
    params: { vs_currency: 'brl', symbols: alvo.toLowerCase() },
  })

  const moeda = escolherMoeda(data, alvo)
  if (!moeda) return null

  return {
    ticker: (moeda.symbol ?? alvo).toUpperCase(),
    price: Number(moeda.current_price),
    shortName: moeda.name ?? alvo,
    quotedAt: parseAtualizadoEm(moeda.last_updated),
  }
}
