import axios from 'axios'
import { fetchQuote, validateTicker, clearQuoteCache } from '../quotes'
import {
  configuredTokens,
  orderTokens,
  isTokenFailure,
  isFeatureUnavailable,
} from '../brapi'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const getMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  clearQuoteCache()
  getMock.mockReset()
  mockedAxios.create = jest.fn(() => ({ get: getMock })) as any
})

const acaoOk = {
  data: {
    results: [
      {
        symbol: 'PETR4',
        shortName: 'PETROBRAS PN',
        regularMarketPrice: 42.3,
        regularMarketTime: '2026-08-31T20:00:00.000Z',
      },
    ],
  },
}

// Formato do CoinGecko: cripto não passa mais pela brapi.
const criptoOk = {
  data: [
    {
      id: 'bitcoin',
      symbol: 'btc',
      name: 'Bitcoin',
      current_price: 350000,
      market_cap_rank: 1,
      last_updated: '2026-08-31T20:00:00.000Z',
    },
  ],
}

describe('fetchQuote', () => {
  it('extrai ticker, preço, nome e horário de uma ação', async () => {
    getMock.mockResolvedValue(acaoOk)
    const quote = await fetchQuote('PETR4', 'stock')
    expect(quote).toEqual({
      ticker: 'PETR4',
      price: 42.3,
      shortName: 'PETROBRAS PN',
      quotedAt: new Date('2026-08-31T20:00:00.000Z'),
    })
  })

  it('usa o mesmo endpoint de ações para FII', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('MXRF11', 'fii')
    expect(getMock.mock.calls[0][0]).toContain('/quote/')
  })

  it('busca cripto no CoinGecko, não na brapi', async () => {
    getMock.mockResolvedValue(criptoOk)
    const quote = await fetchQuote('BTC', 'crypto')
    expect(getMock.mock.calls[0][0]).toBe('/coins/markets')
    expect(getMock.mock.calls[0][1]).toEqual({ params: { vs_currency: 'brl', symbols: 'btc' } })
    expect(quote?.price).toBe(350000)
    expect(quote?.ticker).toBe('BTC')
    expect(quote?.shortName).toBe('Bitcoin')
  })

  it('retorna null quando a API responde sem resultados', async () => {
    getMock.mockResolvedValue({ data: { results: [] } })
    expect(await fetchQuote('XPTO99', 'stock')).toBeNull()
  })

  it('retorna null e não lança quando a requisição falha', async () => {
    getMock.mockRejectedValue(new Error('timeout of 10000ms exceeded'))
    await expect(fetchQuote('PETR4', 'stock')).resolves.toBeNull()
  })

  it('normaliza o ticker para maiúsculas antes de consultar', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('petr4', 'stock')
    expect(getMock.mock.calls[0][0]).toContain('PETR4')
  })

  it('converte regularMarketTime numérico (epoch em segundos) para Date', async () => {
    getMock.mockResolvedValue({
      data: {
        results: [
          { symbol: 'PETR4', shortName: 'PETROBRAS PN', regularMarketPrice: 42.3, regularMarketTime: 1755000000 },
        ],
      },
    })
    const quote = await fetchQuote('PETR4', 'stock')
    expect(quote?.quotedAt).toEqual(new Date(1755000000 * 1000))
  })

  it('cai para uma data válida quando regularMarketTime é uma string impossível de parsear', async () => {
    getMock.mockResolvedValue({
      data: {
        results: [
          { symbol: 'PETR4', shortName: 'PETROBRAS PN', regularMarketPrice: 42.3, regularMarketTime: 'não é uma data' },
        ],
      },
    })
    const quote = await fetchQuote('PETR4', 'stock')
    expect(quote).not.toBeNull()
    expect(Number.isNaN(quote!.quotedAt.getTime())).toBe(false)
  })
})

describe('cache de cotações', () => {
  it('não repete a requisição para o mesmo ticker dentro do TTL', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('PETR4', 'stock')
    await fetchQuote('PETR4', 'stock')
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('refaz a requisição depois que o TTL expira', async () => {
    jest.useFakeTimers()
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('PETR4', 'stock')
    jest.advanceTimersByTime(11 * 60 * 1000)
    await fetchQuote('PETR4', 'stock')
    expect(getMock).toHaveBeenCalledTimes(2)
    jest.useRealTimers()
  })

  it('mantém caches separados por ticker', async () => {
    getMock.mockResolvedValue(acaoOk)
    await fetchQuote('PETR4', 'stock')
    await fetchQuote('VALE3', 'stock')
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('guarda uma falha em cache por um tempo curto, evitando bater a API a cada requisição', async () => {
    jest.useFakeTimers()
    getMock.mockRejectedValueOnce(new Error('erro de rede'))
    getMock.mockResolvedValueOnce(acaoOk)
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    expect(getMock).toHaveBeenCalledTimes(1)
    jest.useRealTimers()
  })

  it('expira o cache negativo depois do TTL curto e tenta de novo', async () => {
    jest.useFakeTimers()
    getMock.mockRejectedValueOnce(new Error('erro de rede'))
    getMock.mockResolvedValueOnce(acaoOk)
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    jest.advanceTimersByTime(61 * 1000)
    expect((await fetchQuote('PETR4', 'stock'))?.price).toBe(42.3)
    jest.useRealTimers()
  })

  it('mantém caches separados por tipo (kind:symbol)', async () => {
    getMock.mockRejectedValueOnce(new Error('erro de rede'))
    getMock.mockResolvedValueOnce(criptoOk)
    // BTC como ação falha, mas o cache negativo não pode contaminar BTC cripto,
    // que vai para outro provedor.
    expect(await fetchQuote('BTC', 'stock')).toBeNull()
    expect((await fetchQuote('BTC', 'crypto'))?.price).toBe(350000)
    expect(getMock).toHaveBeenCalledTimes(2)
  })
})

describe('validateTicker', () => {
  it('aprova quando a cotação existe', async () => {
    getMock.mockResolvedValue(acaoOk)
    expect(await validateTicker('PETR4', 'stock')).toEqual({ ok: true })
  })

  it('reprova com motivo quando a cotação não existe', async () => {
    getMock.mockResolvedValue({ data: { results: [] } })
    expect(await validateTicker('XPTO99', 'stock')).toEqual({ ok: false, motivo: 'sem_cotacao' })
  })

  it('separa indisponibilidade da API de ticker inexistente', async () => {
    getMock.mockRejectedValue(new Error('timeout of 10000ms exceeded'))
    expect(await validateTicker('PETR4', 'stock')).toEqual({
      ok: false,
      motivo: 'falha_na_consulta',
    })
  })
})

// --- Contingência de token ---

const erroHttp = (status: number) =>
  Object.assign(new Error(`Request failed with status code ${status}`), {
    response: { status },
  })

const authDaChamada = (i: number) =>
  (mockedAxios.create as jest.Mock).mock.calls[i][0].headers.Authorization

describe('configuredTokens', () => {
  const original = { ...process.env }
  afterEach(() => {
    process.env.BRAPI_TOKEN = original.BRAPI_TOKEN
    process.env.BRAPI_TOKEN_2 = original.BRAPI_TOKEN_2
  })

  it('devolve os dois tokens na ordem de uso', () => {
    process.env.BRAPI_TOKEN = 'principal'
    process.env.BRAPI_TOKEN_2 = 'reserva'
    expect(configuredTokens().map((t) => t.nome)).toEqual(['BRAPI_TOKEN', 'BRAPI_TOKEN_2'])
  })

  it('ignora token vazio ou só com espaços', () => {
    process.env.BRAPI_TOKEN = '   '
    process.env.BRAPI_TOKEN_2 = 'reserva'
    expect(configuredTokens()).toEqual([{ nome: 'BRAPI_TOKEN_2', valor: 'reserva' }])
  })

  it('não repete o mesmo token colado nas duas variáveis', () => {
    process.env.BRAPI_TOKEN = 'igual'
    process.env.BRAPI_TOKEN_2 = 'igual'
    expect(configuredTokens()).toHaveLength(1)
  })

  it('devolve lista vazia quando nenhum token está configurado', () => {
    delete process.env.BRAPI_TOKEN
    delete process.env.BRAPI_TOKEN_2
    expect(configuredTokens()).toEqual([])
  })
})

describe('orderTokens', () => {
  const tokens = [
    { nome: 'BRAPI_TOKEN', valor: 'a' },
    { nome: 'BRAPI_TOKEN_2', valor: 'b' },
  ]

  it('mantém a ordem declarada quando ninguém está de molho', () => {
    expect(orderTokens(tokens, new Map(), 1000).map((t) => t.valor)).toEqual(['a', 'b'])
  })

  it('joga para o fim o token recusado há pouco', () => {
    const cooldown = new Map([['a', 5000]])
    expect(orderTokens(tokens, cooldown, 1000).map((t) => t.valor)).toEqual(['b', 'a'])
  })

  it('volta a priorizar o token depois que o molho vence', () => {
    const cooldown = new Map([['a', 5000]])
    expect(orderTokens(tokens, cooldown, 6000).map((t) => t.valor)).toEqual(['a', 'b'])
  })
})

describe('isTokenFailure', () => {
  it('reconhece credencial recusada e cota estourada', () => {
    for (const status of [401, 402, 403, 429]) {
      expect(isTokenFailure(erroHttp(status))).toBe(true)
    }
  })

  it('não trata 404, 5xx e timeout como problema de token', () => {
    expect(isTokenFailure(erroHttp(404))).toBe(false)
    expect(isTokenFailure(erroHttp(500))).toBe(false)
    expect(isTokenFailure(new Error('timeout of 10000ms exceeded'))).toBe(false)
  })
})

describe('fallback para o BRAPI_TOKEN_2', () => {
  const original = { ...process.env }

  beforeEach(() => {
    process.env.BRAPI_TOKEN = 'principal'
    process.env.BRAPI_TOKEN_2 = 'reserva'
  })

  afterEach(() => {
    process.env.BRAPI_TOKEN = original.BRAPI_TOKEN
    process.env.BRAPI_TOKEN_2 = original.BRAPI_TOKEN_2
  })

  it('usa o token de contingência quando a cota do principal estoura', async () => {
    getMock.mockRejectedValueOnce(erroHttp(429))
    getMock.mockResolvedValueOnce(acaoOk)

    const quote = await fetchQuote('PETR4', 'stock')

    expect(quote?.price).toBe(42.3)
    expect(getMock).toHaveBeenCalledTimes(2)
    expect(authDaChamada(0)).toBe('Bearer principal')
    expect(authDaChamada(1)).toBe('Bearer reserva')
  })

  it('também troca de token quando a credencial é recusada (401)', async () => {
    getMock.mockRejectedValueOnce(erroHttp(401))
    getMock.mockResolvedValueOnce(acaoOk)
    expect((await fetchQuote('PETR4', 'stock'))?.price).toBe(42.3)
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('não gasta o segundo token em erro de rede', async () => {
    getMock.mockRejectedValue(new Error('timeout of 10000ms exceeded'))
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('não gasta o segundo token quando o ticker não existe (404)', async () => {
    getMock.mockRejectedValue(erroHttp(404))
    expect(await fetchQuote('XPTO99', 'stock')).toBeNull()
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('não tenta o segundo token quando a API responde 200 sem resultado', async () => {
    getMock.mockResolvedValue({ data: { results: [] } })
    expect(await fetchQuote('XPTO99', 'stock')).toBeNull()
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('devolve null quando os dois tokens são recusados', async () => {
    getMock.mockRejectedValue(erroHttp(429))
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('deixa o token queimado de molho e vai direto no reserva no ticker seguinte', async () => {
    getMock.mockRejectedValueOnce(erroHttp(429))
    getMock.mockResolvedValue(acaoOk)

    await fetchQuote('PETR4', 'stock')
    ;(mockedAxios.create as jest.Mock).mockClear()
    await fetchQuote('VALE3', 'stock')

    expect(authDaChamada(0)).toBe('Bearer reserva')
  })

  it('volta a tentar o principal depois que o molho de 30 minutos vence', async () => {
    jest.useFakeTimers()
    getMock.mockRejectedValueOnce(erroHttp(429))
    getMock.mockResolvedValue(acaoOk)

    await fetchQuote('PETR4', 'stock')
    jest.advanceTimersByTime(31 * 60 * 1000)
    ;(mockedAxios.create as jest.Mock).mockClear()
    await fetchQuote('VALE3', 'stock')

    expect(authDaChamada(0)).toBe('Bearer principal')
    jest.useRealTimers()
  })

  it('reabilita o token assim que ele volta a responder', async () => {
    getMock.mockRejectedValueOnce(erroHttp(429))
    getMock.mockResolvedValue(acaoOk)

    await fetchQuote('PETR4', 'stock') // principal cai, reserva atende
    ;(mockedAxios.create as jest.Mock).mockClear()
    await fetchQuote('VALE3', 'stock') // reserva atende de novo e limpa o próprio molho
    ;(mockedAxios.create as jest.Mock).mockClear()
    await fetchQuote('ITUB4', 'stock')

    // O principal segue de molho; o reserva continua na frente.
    expect(authDaChamada(0)).toBe('Bearer reserva')
  })
})

// --- Criptomoeda fora do plano gratuito da brapi ---

const erroPlano = () =>
  Object.assign(new Error('Request failed with status code 403'), {
    response: {
      status: 403,
      data: {
        error: true,
        code: 'FEATURE_NOT_AVAILABLE',
        message: 'Criptomoedas requer o plano Startup (R$ 119,99/mês). Seu plano atual: Gratuito.',
      },
    },
  })

describe('plano que não cobre criptomoedas', () => {
  const original = { ...process.env }

  beforeEach(() => {
    process.env.BRAPI_TOKEN = 'principal'
    process.env.BRAPI_TOKEN_2 = 'reserva'
  })

  afterEach(() => {
    process.env.BRAPI_TOKEN = original.BRAPI_TOKEN
    process.env.BRAPI_TOKEN_2 = original.BRAPI_TOKEN_2
  })

  it('reconhece o 403 de recurso fora do plano', () => {
    expect(isFeatureUnavailable(erroPlano())).toBe(true)
    expect(isFeatureUnavailable(erroHttp(403))).toBe(false)
  })

  it('não conta recurso fora do plano como token recusado', () => {
    expect(isTokenFailure(erroPlano())).toBe(false)
    // 403 sem o código de plano continua sendo problema de credencial.
    expect(isTokenFailure(erroHttp(403))).toBe(true)
  })

  it('ainda tenta o segundo token — ele pode estar em outro plano', async () => {
    getMock.mockRejectedValueOnce(erroPlano())
    getMock.mockResolvedValueOnce(acaoOk)
    expect((await fetchQuote('MXRF11', 'fii'))?.price).toBe(42.3)
    expect(getMock).toHaveBeenCalledTimes(2)
  })

  it('informa o motivo real quando nenhum token cobre o recurso', async () => {
    getMock.mockRejectedValue(erroPlano())
    expect(await validateTicker('MXRF11', 'fii')).toEqual({
      ok: false,
      motivo: 'plano_nao_cobre',
    })
  })

  it('não deixa o token de molho por limite de plano — ele segue bom para o resto', async () => {
    getMock.mockRejectedValue(erroPlano())
    await fetchQuote('MXRF11', 'fii')

    getMock.mockResolvedValue(acaoOk)
    ;(mockedAxios.create as jest.Mock).mockClear()
    await fetchQuote('PETR4', 'stock')

    expect(authDaChamada(0)).toBe('Bearer principal')
  })
})

describe('roteamento por tipo de ativo', () => {
  const original = { ...process.env }

  beforeEach(() => {
    process.env.BRAPI_TOKEN = 'principal'
  })

  afterEach(() => {
    process.env.BRAPI_TOKEN = original.BRAPI_TOKEN
  })

  it('não manda token da brapi para o CoinGecko', async () => {
    getMock.mockResolvedValue(criptoOk)
    await fetchQuote('BTC', 'crypto')
    expect((mockedAxios.create as jest.Mock).mock.calls[0][0].baseURL).toContain('coingecko')
    expect(authDaChamada(0)).toBeUndefined()
  })

  it('cripto não consome os tokens da brapi quando falha', async () => {
    getMock.mockRejectedValue(erroHttp(429))
    expect(await fetchQuote('BTC', 'crypto')).toBeNull()
    // Uma tentativa só: o loop de contingência é exclusivo da brapi.
    expect(getMock).toHaveBeenCalledTimes(1)
  })

  it('traduz o limite do CoinGecko como falha temporária, não ticker inexistente', async () => {
    getMock.mockRejectedValue(erroHttp(429))
    expect(await validateTicker('BTC', 'crypto')).toEqual({
      ok: false,
      motivo: 'falha_na_consulta',
    })
  })

  it('símbolo inexistente no CoinGecko vira sem_cotacao', async () => {
    getMock.mockResolvedValue({ data: [] })
    expect(await validateTicker('XPTO99', 'crypto')).toEqual({
      ok: false,
      motivo: 'sem_cotacao',
    })
  })
})
