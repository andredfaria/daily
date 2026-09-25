import axios from 'axios'
import {
  BrapiToken,
  fetchBrapiHistorico,
  isFeatureUnavailable,
  isTokenFailure,
  marcarTokenRecusado,
  reabilitarToken,
  tokensParaTentar,
} from './brapi'
import { formatDateSaoPaulo } from './assetMath'
import type { Fechamento, TaxaDiaria } from './benchmarkMath'

/**
 * Séries de referência do comparativo da carteira: CDI pelo Banco Central
 * (série SGS 12, pública e sem chave) e IBOV pela brapi (^BVSP).
 *
 * As duas mudam uma vez por dia, então o cache é longo: 6h com sucesso. Falha
 * fica 10 min em cache para a tela de análise não bater na brapi a cada F5
 * quando o plano não cobre o índice. Falha nunca sobe — devolve null e o card
 * mostra o que tiver.
 */

const CACHE_TTL_MS = 6 * 60 * 60 * 1000
const NEGATIVE_CACHE_TTL_MS = 10 * 60 * 1000

const cache = new Map<string, { valor: any; expiresAt: number }>()

export function clearBenchmarkCache(): void {
  cache.clear()
}

async function comCache<T>(chave: string, buscar: () => Promise<T | null>): Promise<T | null> {
  const guardado = cache.get(chave)
  if (guardado && guardado.expiresAt > Date.now()) return guardado.valor
  const valor = await buscar()
  cache.set(chave, {
    valor,
    expiresAt: Date.now() + (valor === null ? NEGATIVE_CACHE_TTL_MS : CACHE_TTL_MS),
  })
  return valor
}

// 'YYYY-MM-DD' ↔ 'dd/MM/yyyy', o formato que a API do Banco Central usa nos dois sentidos.
const paraBcb = (iso: string): string => iso.split('-').reverse().join('/')
const deBcb = (br: string): string => br.split('/').reverse().join('-')

/** Taxas diárias do CDI desde `desde` (YYYY-MM-DD) até hoje. */
export function buscarCdi(desde: string): Promise<TaxaDiaria[] | null> {
  return comCache(`cdi:${desde}`, async () => {
    try {
      const { data } = await axios.get('https://api.bcb.gov.br/dados/serie/bcdata.sgs.12/dados', {
        params: {
          formato: 'json',
          dataInicial: paraBcb(desde),
          dataFinal: paraBcb(formatDateSaoPaulo(new Date())),
        },
        timeout: 10000,
      })
      if (!Array.isArray(data)) return null
      return data
        .map((d: any) => ({ date: deBcb(String(d.data)), pct: Number(d.valor) }))
        .filter((t) => Number.isFinite(t.pct))
    } catch (err: any) {
      console.error('[benchmarks] erro ao buscar CDI no Banco Central:', err.message)
      return null
    }
  })
}

/** Menor range da brapi que cobre a janela, para não pedir histórico à toa. */
export function rangeParaDias(days: number): string {
  if (days <= 30) return '1mo'
  if (days <= 90) return '3mo'
  if (days <= 180) return '6mo'
  return '1y'
}

/**
 * Fechamentos diários do IBOV. Segue a mesma contingência de token das
 * cotações: token recusado por credencial/cota fica de molho e passa a vez;
 * plano que não cobre tenta o outro sem deixar este de molho; rede, 404 e 5xx
 * param na hora.
 */
export function buscarIbov(days: number): Promise<Fechamento[] | null> {
  const range = rangeParaDias(days)
  return comCache(`ibov:${range}`, async () => {
    const disponiveis = tokensParaTentar()
    const tentativas: (BrapiToken | undefined)[] = disponiveis.length > 0 ? disponiveis : [undefined]
    let ultimoErro: any = null

    for (const token of tentativas) {
      try {
        const historico = await fetchBrapiHistorico('^BVSP', range, token?.valor)
        if (token) reabilitarToken(token)
        if (historico.length === 0) {
          console.warn(`[benchmarks] brapi não devolveu histórico do IBOV (range ${range})`)
          return null
        }
        return historico.map((h) => ({ date: formatDateSaoPaulo(h.date), close: h.close }))
      } catch (err: any) {
        ultimoErro = err
        if (isFeatureUnavailable(err)) continue
        if (token && isTokenFailure(err)) {
          marcarTokenRecusado(token)
          continue
        }
        break
      }
    }

    console.error(
      '[benchmarks] erro ao buscar IBOV na brapi:',
      ultimoErro?.response?.data?.message ?? ultimoErro?.message,
    )
    return null
  })
}
