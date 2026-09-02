import type { AssetKind } from './assetMath'
import {
  BrapiToken,
  fetchBrapiQuote,
  isFeatureUnavailable,
  isTokenFailure,
  limparMolhoDeTokens,
  marcarTokenRecusado,
  reabilitarToken,
  tokensParaTentar,
  configuredTokens,
} from './brapi'
import { fetchCryptoQuote } from './coingecko'

/**
 * Porta de entrada das cotações. Roteia por tipo de ativo:
 * ação e FII vão para a brapi.dev, criptomoeda vai para o CoinGecko — a brapi
 * cobra plano pago por cripto. O cache e o motivo da falha ficam aqui, iguais
 * para os dois provedores.
 */

export interface Quote {
  ticker: string
  price: number
  shortName: string
  quotedAt: Date
}

/**
 * Por que a cotação não veio. Guardado junto do cache negativo para as rotas
 * conseguirem responder o motivo real em vez de um "não encontrei" genérico —
 * é a diferença entre o usuário corrigir o ticker e o usuário entender que a
 * consulta está temporariamente indisponível.
 */
export type MotivoIndisponivel = 'sem_cotacao' | 'plano_nao_cobre' | 'falha_na_consulta'

export interface ResultadoCotacao {
  quote: Quote | null
  motivo?: MotivoIndisponivel
}

const CACHE_TTL_MS = 10 * 60 * 1000

// Falha (rede, ticker sem cotação) também entra em cache, mas com TTL bem menor
// que o de sucesso: sem BRAPI_TOKEN todo ticker fora dos 4 livres falha sempre,
// e sem cache negativo cada GET /api/assets bateria de novo em todos eles (10s de
// timeout cada) até estourar a cota mensal. 60s evita isso sem prender por muito
// tempo uma falha que pode ter sido só uma instabilidade passageira.
const NEGATIVE_CACHE_TTL_MS = 60 * 1000

// A tela consulta cotações a cada carregamento; sem cache um F5 repetido queima
// tanto o limite mensal da brapi quanto o limite por minuto do CoinGecko.
// Chave inclui o tipo (kind:symbol) para não deixar um ticker validado como
// cripto ser aceito como ação (ou vice-versa) a partir de um cache quente.
const cache = new Map<
  string,
  { quote: Quote | null; motivo?: MotivoIndisponivel; expiresAt: number }
>()

export function clearQuoteCache(): void {
  cache.clear()
  // O molho dos tokens é o mesmo estado em memória — reset limpa os dois.
  limparMolhoDeTokens()
}

async function buscarCripto(symbol: string): Promise<ResultadoCotacao> {
  try {
    const quote = await fetchCryptoQuote(symbol)
    if (!quote || !Number.isFinite(quote.price)) {
      console.warn(`[coingecko] sem cotação para ${symbol}`)
      return { quote: null, motivo: 'sem_cotacao' }
    }
    return { quote }
  } catch (err: any) {
    // 429 é o limite gratuito por minuto: o cache negativo de 60s segura a
    // próxima tentativa em vez de insistir e continuar bloqueado.
    const status = err?.response?.status
    console.error(
      `[coingecko] erro ao buscar ${symbol}:`,
      status === 429 ? 'limite de requisições atingido' : err.message,
    )
    return { quote: null, motivo: 'falha_na_consulta' }
  }
}

async function buscarNaBrapi(symbol: string): Promise<ResultadoCotacao> {
  if (configuredTokens().length === 0) {
    console.warn('[brapi] nenhum token definido (BRAPI_TOKEN / BRAPI_TOKEN_2) — apenas PETR4, MGLU3, VALE3 e ITUB4 responderão')
  }
  // Sem token ainda vale a tentativa anônima: os 4 tickers livres respondem.
  const disponiveis = tokensParaTentar()
  const tentativas: (BrapiToken | undefined)[] = disponiveis.length > 0 ? disponiveis : [undefined]

  let ultimoErro: any = null
  let semPlano = false

  for (let i = 0; i < tentativas.length; i++) {
    const token = tentativas[i]
    const proximo = tentativas[i + 1]
    try {
      const quote = await fetchBrapiQuote(symbol, token?.valor)

      if (!quote || !Number.isFinite(quote.price)) {
        console.warn(`[brapi] sem cotação para ${symbol}`)
        return { quote: null, motivo: 'sem_cotacao' }
      }

      // Deu certo: se este token estava de molho, está reabilitado.
      if (token) reabilitarToken(token)
      return { quote }
    } catch (err: any) {
      ultimoErro = err

      // Plano não cobre o recurso: tenta o outro token (pode estar em outro
      // plano), mas sem deixar este de molho — ele segue bom para o resto.
      if (isFeatureUnavailable(err)) {
        semPlano = true
        console.warn(
          `[brapi] ${token?.nome ?? 'acesso anônimo'} não cobre ${symbol}: ${err.response.data?.message ?? 'recurso indisponível no plano'}` +
            (proximo ? ` — tentando ${proximo.nome}` : ''),
        )
        continue
      }

      if (token && isTokenFailure(err)) {
        marcarTokenRecusado(token)
        console.warn(
          `[brapi] ${token.nome} recusado (HTTP ${err.response.status})` +
            (proximo ? ` — tentando ${proximo.nome}` : ' — sem token de contingência disponível'),
        )
        continue
      }

      // Rede, 404 ou 5xx: trocar de token não muda nada, para por aqui.
      break
    }
  }

  console.error(`[brapi] erro ao buscar ${symbol}:`, ultimoErro?.message)
  return { quote: null, motivo: semPlano ? 'plano_nao_cobre' : 'falha_na_consulta' }
}

async function obterCotacao(ticker: string, kind: AssetKind): Promise<ResultadoCotacao> {
  const symbol = ticker.trim().toUpperCase()
  const cacheKey = `${kind}:${symbol}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { quote: cached.quote, motivo: cached.motivo }
  }

  // Falha nunca sobe: o tick do scheduler precisa continuar.
  const resultado = kind === 'crypto' ? await buscarCripto(symbol) : await buscarNaBrapi(symbol)

  cache.set(cacheKey, {
    quote: resultado.quote,
    motivo: resultado.motivo,
    expiresAt: Date.now() + (resultado.quote ? CACHE_TTL_MS : NEGATIVE_CACHE_TTL_MS),
  })
  return resultado
}

export async function fetchQuote(ticker: string, kind: AssetKind): Promise<Quote | null> {
  return (await obterCotacao(ticker, kind)).quote
}

export interface TickerCheck {
  ok: boolean
  motivo?: MotivoIndisponivel
}

export async function validateTicker(ticker: string, kind: AssetKind): Promise<TickerCheck> {
  const { quote, motivo } = await obterCotacao(ticker, kind)
  return quote !== null ? { ok: true } : { ok: false, motivo: motivo ?? 'sem_cotacao' }
}
