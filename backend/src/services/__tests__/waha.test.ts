import { generatePhoneVariant, buildPhoneCandidates, parseContactPayload, buildContactId, parseProfilePictureUrl, bufferParaDataUri, TETO_FOTO_BYTES } from '../waha'

describe('generatePhoneVariant', () => {
  it('adiciona 9 a numero de 12 digitos', () => {
    expect(generatePhoneVariant('551187654321')).toBe('5511987654321')
  })

  it('remove 9 de numero de 13 digitos', () => {
    expect(generatePhoneVariant('5511987654321')).toBe('551187654321')
  })

  it('retorna null para numero com menos de 12 digitos', () => {
    expect(generatePhoneVariant('12345678901')).toBeNull()
  })

  it('retorna null para numero com mais de 13 digitos', () => {
    expect(generatePhoneVariant('55119876543210')).toBeNull()
  })
})

describe('buildPhoneCandidates', () => {
  it('inclui digits, resolvedNumber e variante quando WAHA resolve diferente', () => {
    const result = buildPhoneCandidates('551187654321', '5511987654321')
    expect(result).toContain('551187654321')
    expect(result).toContain('5511987654321')
    expect(result.length).toBe(2) // resolvedNumber e variant são o mesmo, sem duplicata
  })

  it('deduplica e inclui variante quando WAHA falha (resolvedNumber == digits)', () => {
    const result = buildPhoneCandidates('5511987654321', '5511987654321')
    expect(result).toContain('5511987654321')
    expect(result).toContain('551187654321') // variante gerada por string
    expect(result.filter((n: string) => n === '5511987654321').length).toBe(1) // sem duplicata
  })

  it('nao duplica quando digits e resolved e variant sao todos iguais (numero nao-BR)', () => {
    // 11 digitos — generatePhoneVariant retorna null
    expect(buildPhoneCandidates('12345678901', '12345678901')).toEqual(['12345678901'])
  })
})

describe('parseContactPayload', () => {
  it('lê pushname minúsculo, que é o que o engine GOWS devolve', () => {
    expect(parseContactPayload({ name: 'André Eu', pushname: 'André de Faria' }))
      .toEqual({ savedName: 'André Eu', pushName: 'André de Faria' })
  })

  it('aceita também pushName camelCase, caso o engine mude', () => {
    expect(parseContactPayload({ pushName: 'André de Faria' }))
      .toEqual({ savedName: null, pushName: 'André de Faria' })
  })

  it('desembrulha resposta em array', () => {
    expect(parseContactPayload([{ name: 'X', pushname: 'Y' }]))
      .toEqual({ savedName: 'X', pushName: 'Y' })
  })

  it('devolve nulos para payload vazio, nulo ou de tipo errado', () => {
    const vazio = { savedName: null, pushName: null }
    expect(parseContactPayload(null)).toEqual(vazio)
    expect(parseContactPayload([])).toEqual(vazio)
    expect(parseContactPayload({ name: 123, pushname: {} })).toEqual(vazio)
  })

  it('trata string vazia como ausente', () => {
    expect(parseContactPayload({ name: '', pushname: '   ' }))
      .toEqual({ savedName: null, pushName: null })
  })
})

describe('buildContactId', () => {
  it('acrescenta @c.us em numero puro', () => {
    expect(buildContactId('553591404064')).toBe('553591404064@c.us')
  })

  it('limpa mascara antes de montar o id', () => {
    expect(buildContactId('+55 (35) 9140-4064')).toBe('553591404064@c.us')
  })

  it('preserva id que ja vem com sufixo @lid', () => {
    expect(buildContactId('51810291171433@lid')).toBe('51810291171433@lid')
  })

  it('preserva id que ja vem com sufixo @c.us', () => {
    expect(buildContactId('553591404064@c.us')).toBe('553591404064@c.us')
  })
})

describe('parseProfilePictureUrl', () => {
  it('le profilePictureURL do engine GOWS', () => {
    expect(parseProfilePictureUrl({ profilePictureURL: 'https://pps.whatsapp.net/x.jpg' }))
      .toBe('https://pps.whatsapp.net/x.jpg')
  })

  it('aceita as grafias alternativas', () => {
    expect(parseProfilePictureUrl({ profilePicUrl: 'https://a/x.jpg' })).toBe('https://a/x.jpg')
    expect(parseProfilePictureUrl({ url: 'https://b/x.jpg' })).toBe('https://b/x.jpg')
  })

  it('devolve null quando o contato nao tem foto', () => {
    expect(parseProfilePictureUrl({ profilePictureURL: null })).toBeNull()
    expect(parseProfilePictureUrl({})).toBeNull()
    expect(parseProfilePictureUrl(null)).toBeNull()
    expect(parseProfilePictureUrl({ profilePictureURL: '' })).toBeNull()
  })
})

// O CSP do app é `img-src 'self' data:` — uma URL do pps.whatsapp.net nunca
// carrega no navegador. A foto tem que chegar ao front já embutida.
describe('bufferParaDataUri', () => {
  it('monta data URI com o content-type devolvido pelo CDN', () => {
    expect(bufferParaDataUri(Buffer.from([0xff, 0xd8, 0xff]), 'image/jpeg'))
      .toBe('data:image/jpeg;base64,/9j/')
  })

  it('assume jpeg quando o CDN nao manda content-type de imagem', () => {
    expect(bufferParaDataUri(Buffer.from([0xff, 0xd8, 0xff]), undefined))
      .toBe('data:image/jpeg;base64,/9j/')
    expect(bufferParaDataUri(Buffer.from([0xff, 0xd8, 0xff]), 'application/octet-stream'))
      .toBe('data:image/jpeg;base64,/9j/')
  })

  it('ignora o charset que vem grudado no content-type', () => {
    expect(bufferParaDataUri(Buffer.from([0xff]), 'image/png; charset=binary'))
      .toBe('data:image/png;base64,/w==')
  })

  it('devolve null para corpo vazio', () => {
    expect(bufferParaDataUri(Buffer.alloc(0), 'image/jpeg')).toBeNull()
  })

  it('devolve null acima do teto de tamanho, para nao inchar o JSON', () => {
    expect(bufferParaDataUri(Buffer.alloc(TETO_FOTO_BYTES + 1), 'image/jpeg')).toBeNull()
  })
})
