import axios from 'axios'
import { fetchQuote, validateTicker, clearQuoteCache } from '../brapi'

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

const criptoOk = {
  data: {
    coins: [
      {
        coin: 'BTC',
        coinName: 'Bitcoin',
        regularMarketPrice: 350000,
        regularMarketTime: '2026-08-31T20:00:00.000Z',
      },
    ],
  },
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

  it('usa o endpoint de cripto para kind crypto', async () => {
    getMock.mockResolvedValue(criptoOk)
    const quote = await fetchQuote('BTC', 'crypto')
    expect(getMock.mock.calls[0][0]).toContain('/v2/crypto')
    expect(quote?.price).toBe(350000)
    expect(quote?.ticker).toBe('BTC')
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

  it('não guarda em cache uma falha', async () => {
    getMock.mockRejectedValueOnce(new Error('erro de rede'))
    getMock.mockResolvedValueOnce(acaoOk)
    expect(await fetchQuote('PETR4', 'stock')).toBeNull()
    expect((await fetchQuote('PETR4', 'stock'))?.price).toBe(42.3)
  })
})

describe('validateTicker', () => {
  it('retorna true quando a cotação existe', async () => {
    getMock.mockResolvedValue(acaoOk)
    expect(await validateTicker('PETR4', 'stock')).toBe(true)
  })

  it('retorna false quando a cotação não existe', async () => {
    getMock.mockResolvedValue({ data: { results: [] } })
    expect(await validateTicker('XPTO99', 'stock')).toBe(false)
  })
})
