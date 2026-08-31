import axios from 'axios'
import type { AssetKind } from './assetMath'

export interface Quote {
  ticker: string
  price: number
  shortName: string
  quotedAt: Date
}

const CACHE_TTL_MS = 10 * 60 * 1000

// A tela consulta cotações a cada carregamento; sem cache um F5 repetido
// queima o limite mensal de 15.000 requisições do plano gratuito.
const cache = new Map<string, { quote: Quote; expiresAt: number }>()

export function clearQuoteCache(): void {
  cache.clear()
}

function brapiClient() {
  const token = process.env.BRAPI_TOKEN
  if (!token) {
    console.warn('[brapi] BRAPI_TOKEN não definido — apenas PETR4, MGLU3, VALE3 e ITUB4 responderão')
  }
  return axios.create({
    baseURL: 'https://brapi.dev/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 10000,
  })
}

function parseQuotedAt(raw: unknown): Date {
  if (typeof raw === 'number') return new Date(raw * 1000)
  if (typeof raw === 'string') return new Date(raw)
  return new Date()
}

export async function fetchQuote(ticker: string, kind: AssetKind): Promise<Quote | null> {
  const symbol = ticker.trim().toUpperCase()
  const cached = cache.get(symbol)
  if (cached && cached.expiresAt > Date.now()) return cached.quote

  try {
    const client = brapiClient()
    let quote: Quote | null = null

    if (kind === 'crypto') {
      const { data } = await client.get(`/v2/crypto?coin=${symbol}&currency=BRL`)
      const coin = data?.coins?.[0]
      if (coin) {
        quote = {
          ticker: coin.coin ?? symbol,
          price: Number(coin.regularMarketPrice),
          shortName: coin.coinName ?? symbol,
          quotedAt: parseQuotedAt(coin.regularMarketTime),
        }
      }
    } else {
      const { data } = await client.get(`/quote/${symbol}`)
      const result = data?.results?.[0]
      if (result) {
        quote = {
          ticker: result.symbol ?? symbol,
          price: Number(result.regularMarketPrice),
          shortName: result.shortName ?? result.longName ?? symbol,
          quotedAt: parseQuotedAt(result.regularMarketTime),
        }
      }
    }

    if (!quote || !Number.isFinite(quote.price)) {
      console.warn(`[brapi] sem cotação para ${symbol}`)
      return null
    }

    cache.set(symbol, { quote, expiresAt: Date.now() + CACHE_TTL_MS })
    return quote
  } catch (err: any) {
    // Falha de rede nunca sobe: o tick do scheduler precisa continuar.
    console.error(`[brapi] erro ao buscar ${symbol}:`, err.message)
    return null
  }
}

export async function validateTicker(ticker: string, kind: AssetKind): Promise<boolean> {
  return (await fetchQuote(ticker, kind)) !== null
}
