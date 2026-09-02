import axios from 'axios'
import { escolherMoeda, fetchCryptoQuote, MoedaCoinGecko } from '../coingecko'

jest.mock('axios')
const mockedAxios = axios as jest.Mocked<typeof axios>

const getMock = jest.fn()

beforeEach(() => {
  jest.clearAllMocks()
  getMock.mockReset()
  mockedAxios.create = jest.fn(() => ({ get: getMock })) as any
})

const moeda = (over: Partial<MoedaCoinGecko>): MoedaCoinGecko => ({
  id: 'bitcoin',
  symbol: 'btc',
  name: 'Bitcoin',
  current_price: 350000,
  market_cap_rank: 1,
  last_updated: '2026-08-31T20:00:00.000Z',
  ...over,
})

describe('escolherMoeda', () => {
  it('encontra a moeda pelo símbolo, ignorando maiúsculas', () => {
    expect(escolherMoeda([moeda({})], 'BTC')?.id).toBe('bitcoin')
  })

  it('fica com a maior capitalização quando o símbolo se repete', () => {
    const lista = [
      moeda({ id: 'sol-copycat', symbol: 'sol', name: 'Sol Falsa', market_cap_rank: 4210 }),
      moeda({ id: 'solana', symbol: 'sol', name: 'Solana', market_cap_rank: 7 }),
    ]
    expect(escolherMoeda(lista, 'SOL')?.id).toBe('solana')
  })

  it('trata moeda sem ranking como a menos relevante', () => {
    const lista = [
      moeda({ id: 'sem-rank', symbol: 'abc', market_cap_rank: null }),
      moeda({ id: 'com-rank', symbol: 'abc', market_cap_rank: 900 }),
    ]
    expect(escolherMoeda(lista, 'ABC')?.id).toBe('com-rank')
  })

  it('descarta resultado sem preço utilizável', () => {
    expect(escolherMoeda([moeda({ current_price: null })], 'BTC')).toBeNull()
    expect(escolherMoeda([moeda({ current_price: 0 })], 'BTC')).toBeNull()
  })

  it('não devolve moeda de símbolo diferente do pedido', () => {
    expect(escolherMoeda([moeda({})], 'ETH')).toBeNull()
  })

  it('aguenta lista vazia e resposta que não é lista', () => {
    expect(escolherMoeda([], 'BTC')).toBeNull()
    expect(escolherMoeda(undefined as any, 'BTC')).toBeNull()
  })
})

describe('fetchCryptoQuote', () => {
  it('consulta em BRL com o símbolo em minúsculas', async () => {
    getMock.mockResolvedValue({ data: [moeda({})] })
    await fetchCryptoQuote('btc')
    expect(getMock).toHaveBeenCalledWith('/coins/markets', {
      params: { vs_currency: 'brl', symbols: 'btc' },
    })
  })

  it('devolve a cotação normalizada', async () => {
    getMock.mockResolvedValue({ data: [moeda({})] })
    expect(await fetchCryptoQuote('BTC')).toEqual({
      ticker: 'BTC',
      price: 350000,
      shortName: 'Bitcoin',
      quotedAt: new Date('2026-08-31T20:00:00.000Z'),
    })
  })

  it('cai para "agora" quando last_updated não dá para parsear', async () => {
    getMock.mockResolvedValue({ data: [moeda({ last_updated: 'não é uma data' })] })
    const quote = await fetchCryptoQuote('BTC')
    expect(Number.isNaN(quote!.quotedAt.getTime())).toBe(false)
  })

  it('devolve null quando o símbolo não existe', async () => {
    getMock.mockResolvedValue({ data: [] })
    expect(await fetchCryptoQuote('XPTO99')).toBeNull()
  })

  it('deixa o erro HTTP subir para quem chamou decidir', async () => {
    getMock.mockRejectedValue(new Error('Request failed with status code 429'))
    await expect(fetchCryptoQuote('BTC')).rejects.toThrow('429')
  })

  it('manda a chave demo quando COINGECKO_API_KEY está definida', async () => {
    process.env.COINGECKO_API_KEY = 'chave-demo'
    getMock.mockResolvedValue({ data: [moeda({})] })
    await fetchCryptoQuote('BTC')
    expect((mockedAxios.create as jest.Mock).mock.calls[0][0].headers).toEqual({
      'x-cg-demo-api-key': 'chave-demo',
    })
    delete process.env.COINGECKO_API_KEY
  })

  it('funciona sem chave, com a API pública', async () => {
    delete process.env.COINGECKO_API_KEY
    getMock.mockResolvedValue({ data: [moeda({})] })
    await fetchCryptoQuote('BTC')
    expect((mockedAxios.create as jest.Mock).mock.calls[0][0].headers).toEqual({})
  })
})
