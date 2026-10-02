import { ehTokenLegado, gerarTokenSessao, hashTokenSessao, limitarUserAgent } from '../sessionToken'

describe('gerarTokenSessao', () => {
  it('gera 32 bytes em base64url, sem ponto', () => {
    const token = gerarTokenSessao()
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
  })

  it('não repete', () => {
    expect(gerarTokenSessao()).not.toBe(gerarTokenSessao())
  })

  it('nunca é confundido com JWT legado', () => {
    for (let i = 0; i < 50; i++) expect(ehTokenLegado(gerarTokenSessao())).toBe(false)
  })
})

describe('hashTokenSessao', () => {
  it('é determinístico e hex de 64 caracteres', () => {
    const h = hashTokenSessao('abc')
    expect(h).toBe(hashTokenSessao('abc'))
    expect(h).toMatch(/^[0-9a-f]{64}$/)
  })

  it('não devolve o token', () => {
    expect(hashTokenSessao('abc')).not.toContain('abc')
  })
})

describe('ehTokenLegado', () => {
  it('reconhece JWT', () => {
    expect(ehTokenLegado('eyJhbGciOiJIUzI1NiJ9.eyJ1c2VySWQiOiJ4In0.assinatura')).toBe(true)
  })
})

describe('limitarUserAgent', () => {
  it('corta em 255', () => {
    expect(limitarUserAgent('a'.repeat(400))).toHaveLength(255)
  })

  it('vazio ou ausente vira null', () => {
    expect(limitarUserAgent('  ')).toBeNull()
    expect(limitarUserAgent(undefined)).toBeNull()
    expect(limitarUserAgent(['x'])).toBeNull()
  })
})
