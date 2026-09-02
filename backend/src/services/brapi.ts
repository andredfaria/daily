import axios from 'axios'
import type { Quote } from './quotes'

/**
 * Cotação de ações e FIIs pela brapi.dev.
 *
 * Criptomoeda não passa por aqui: a brapi a moveu para o plano pago e responde
 * `403 FEATURE_NOT_AVAILABLE` com token gratuito. Quem cuida disso é o
 * `coingecko.ts`, e o roteamento por tipo vive no `quotes.ts`.
 */

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

export function limparMolhoDeTokens(): void {
  tokenCooldown.clear()
}

export function marcarTokenRecusado(token: BrapiToken): void {
  tokenCooldown.set(token.valor, Date.now() + TOKEN_COOLDOWN_MS)
}

export function reabilitarToken(token: BrapiToken): void {
  tokenCooldown.delete(token.valor)
}

/**
 * O plano da conta não cobre o recurso pedido. Vale tentar o outro token — ele
 * pode estar em outro plano —, mas não é motivo para deixar este de molho: ele
 * continua perfeitamente bom para o resto.
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

/** Tokens na ordem em que devem ser tentados agora. */
export function tokensParaTentar(): BrapiToken[] {
  return orderTokens(configuredTokens(), tokenCooldown, Date.now())
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

/** Cotação de um ticker da B3. Erros de rede e HTTP sobem para o chamador. */
export async function fetchBrapiQuote(symbol: string, token?: string): Promise<Quote | null> {
  const { data } = await brapiClient(token).get(`/quote/${symbol}`)
  const result = data?.results?.[0]
  if (!result) return null
  return {
    ticker: result.symbol ?? symbol,
    price: Number(result.regularMarketPrice),
    shortName: result.shortName ?? result.longName ?? symbol,
    quotedAt: parseQuotedAt(result.regularMarketTime),
  }
}
