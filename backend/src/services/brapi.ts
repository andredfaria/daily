import axios from 'axios'
import type { AssetKind } from './assetMath'

export interface Quote {
  ticker: string
  price: number
  shortName: string
  quotedAt: Date
}

const CACHE_TTL_MS = 10 * 60 * 1000

// Falha (rede, ticker sem cotação) também entra em cache, mas com TTL bem menor
// que o de sucesso: sem BRAPI_TOKEN todo ticker fora dos 4 livres falha sempre,
// e sem cache negativo cada GET /api/assets bateria de novo em todos eles (10s de
// timeout cada) até estourar a cota mensal. 60s evita isso sem prender por muito
// tempo uma falha que pode ter sido só uma instabilidade passageira da brapi.
const NEGATIVE_CACHE_TTL_MS = 60 * 1000

// A tela consulta cotações a cada carregamento; sem cache um F5 repetido
// queima o limite mensal de 15.000 requisições do plano gratuito.
// Chave inclui o tipo (kind:symbol) para não deixar um ticker validado como
// cripto ser aceito como ação (ou vice-versa) a partir de um cache quente.
const cache = new Map<
  string,
  { quote: Quote | null; motivo?: MotivoIndisponivel; expiresAt: number }
>()

export interface BrapiToken {
  /** Nome da variável de ambiente — é o que vai para o log, nunca o segredo. */
  nome: string
  valor: string
}

// Status em que trocar de token resolve: credencial recusada (401/403) e cota
// estourada (402/429), que é o que acontece quando os 15.000 req/mês do plano
// gratuito acabam. Timeout, 404 e 5xx não são problema de token — repetir a
// chamada com o segundo só gastaria a cota dele também.
const TOKEN_FAILURE_STATUSES = [401, 402, 403, 429]

// Token recusado fica de molho: sem isso, com o primário sem cota, cada ticker
// pagaria uma requisição perdida nele antes de chegar no de contingência. 30min
// é curto o bastante para o primário voltar sozinho se foi só um 429 passageiro.
const TOKEN_COOLDOWN_MS = 30 * 60 * 1000
const tokenCooldown = new Map<string, number>()

export function clearQuoteCache(): void {
  cache.clear()
  // O molho dos tokens é o mesmo estado em memória — reset limpa os dois.
  tokenCooldown.clear()
}

/**
 * O plano da conta não cobre o recurso pedido (hoje: criptomoedas, que a brapi
 * move para o plano Startup). Vale tentar o outro token — ele pode estar em
 * outro plano —, mas não é motivo para deixar este de molho: ele continua
 * perfeitamente bom para ações e FIIs.
 */
export function isFeatureUnavailable(err: any): boolean {
  return err?.response?.status === 403 && err?.response?.data?.code === 'FEATURE_NOT_AVAILABLE'
}

/** A falha veio do token (ou da cota dele) e vale tentar o próximo? */
export function isTokenFailure(err: any): boolean {
  if (isFeatureUnavailable(err)) return false
  const status = err?.response?.status
  return typeof status === 'number' && TOKEN_FAILURE_STATUSES.includes(status)
}

/** Tokens configurados na ordem de uso, sem vazios nem repetidos. */
export function configuredTokens(): BrapiToken[] {
  const brutos = [
    { nome: 'BRAPI_TOKEN', valor: process.env.BRAPI_TOKEN },
    { nome: 'BRAPI_TOKEN_2', valor: process.env.BRAPI_TOKEN_2 },
  ]
  const vistos = new Set<string>()
  const tokens: BrapiToken[] = []
  for (const { nome, valor } of brutos) {
    const limpo = (valor ?? '').trim()
    if (limpo === '' || vistos.has(limpo)) continue
    vistos.add(limpo)
    tokens.push({ nome, valor: limpo })
  }
  return tokens
}

/** Quem não está de molho vem primeiro; quem está fica como último recurso. */
export function orderTokens(
  tokens: BrapiToken[],
  cooldown: Map<string, number>,
  now: number,
): BrapiToken[] {
  const livres = tokens.filter((t) => (cooldown.get(t.valor) ?? 0) <= now)
  const deMolho = tokens.filter((t) => (cooldown.get(t.valor) ?? 0) > now)
  return [...livres, ...deMolho]
}

function brapiClient(token?: string) {
  return axios.create({
    baseURL: 'https://brapi.dev/api',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    timeout: 10000,
  })
}

function parseQuotedAt(raw: unknown): Date {
  let d: Date
  if (typeof raw === 'number') d = new Date(raw * 1000)
  else if (typeof raw === 'string') d = new Date(raw)
  else d = new Date()
  // Data impossível de parsear (ou epoch absurdo) não pode virar um RangeError
  // lá na frente, em formatDateSaoPaulo — cai para "agora", que é sempre válido.
  return Number.isNaN(d.getTime()) ? new Date() : d
}

async function buscarCotacao(
  symbol: string,
  kind: AssetKind,
  token?: string,
): Promise<Quote | null> {
  const client = brapiClient(token)

  if (kind === 'crypto') {
    const { data } = await client.get(`/v2/crypto?coin=${symbol}&currency=BRL`)
    const coin = data?.coins?.[0]
    if (!coin) return null
    return {
      ticker: coin.coin ?? symbol,
      price: Number(coin.regularMarketPrice),
      shortName: coin.coinName ?? symbol,
      quotedAt: parseQuotedAt(coin.regularMarketTime),
    }
  }

  const { data } = await client.get(`/quote/${symbol}`)
  const result = data?.results?.[0]
  if (!result) return null
  return {
    ticker: result.symbol ?? symbol,
    price: Number(result.regularMarketPrice),
    shortName: result.shortName ?? result.longName ?? symbol,
    quotedAt: parseQuotedAt(result.regularMarketTime),
  }
}

/**
 * Por que a cotação não veio. Guardado junto do cache negativo para as rotas
 * conseguirem responder o motivo real em vez de um "não encontrei" genérico —
 * é a diferença entre o usuário corrigir o ticker e o usuário entender que
 * criptomoeda exige plano pago na brapi.
 */
export type MotivoIndisponivel = 'sem_cotacao' | 'plano_nao_cobre' | 'falha_na_consulta'

export interface ResultadoCotacao {
  quote: Quote | null
  motivo?: MotivoIndisponivel
}

async function obterCotacao(ticker: string, kind: AssetKind): Promise<ResultadoCotacao> {
  const symbol = ticker.trim().toUpperCase()
  const cacheKey = `${kind}:${symbol}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expiresAt > Date.now()) {
    return { quote: cached.quote, motivo: cached.motivo }
  }

  const guardarFalha = (motivo: MotivoIndisponivel): ResultadoCotacao => {
    cache.set(cacheKey, { quote: null, motivo, expiresAt: Date.now() + NEGATIVE_CACHE_TTL_MS })
    return { quote: null, motivo }
  }

  const configurados = configuredTokens()
  if (configurados.length === 0) {
    console.warn('[brapi] nenhum token definido (BRAPI_TOKEN / BRAPI_TOKEN_2) — apenas PETR4, MGLU3, VALE3 e ITUB4 responderão')
  }
  // Sem token ainda vale a tentativa anônima: os 4 tickers livres respondem.
  const tentativas: (BrapiToken | undefined)[] =
    configurados.length > 0 ? orderTokens(configurados, tokenCooldown, Date.now()) : [undefined]

  let ultimoErro: any = null
  let semPlano = false

  for (let i = 0; i < tentativas.length; i++) {
    const token = tentativas[i]
    const proximo = tentativas[i + 1]
    try {
      const quote = await buscarCotacao(symbol, kind, token?.valor)

      if (!quote || !Number.isFinite(quote.price)) {
        console.warn(`[brapi] sem cotação para ${symbol}`)
        return guardarFalha('sem_cotacao')
      }

      // Deu certo: se este token estava de molho, está reabilitado.
      if (token) tokenCooldown.delete(token.valor)
      cache.set(cacheKey, { quote, expiresAt: Date.now() + CACHE_TTL_MS })
      return { quote }
    } catch (err: any) {
      ultimoErro = err

      // Plano não cobre o recurso: tenta o outro token (pode estar em outro
      // plano), mas sem deixar este de molho — ele segue bom para ações e FIIs.
      if (isFeatureUnavailable(err)) {
        semPlano = true
        console.warn(
          `[brapi] ${token?.nome ?? 'acesso anônimo'} não cobre ${symbol}: ${err.response.data?.message ?? 'recurso indisponível no plano'}` +
            (proximo ? ` — tentando ${proximo.nome}` : ''),
        )
        continue
      }

      if (token && isTokenFailure(err)) {
        tokenCooldown.set(token.valor, Date.now() + TOKEN_COOLDOWN_MS)
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

  // Falha nunca sobe: o tick do scheduler precisa continuar.
  console.error(`[brapi] erro ao buscar ${symbol}:`, ultimoErro?.message)
  return guardarFalha(semPlano ? 'plano_nao_cobre' : 'falha_na_consulta')
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
