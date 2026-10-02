import { extrairCategoria, inferirCategoria, normalizarCategoria } from '../expenseCategories'

describe('inferirCategoria', () => {
  it.each([
    ['mercado', 'alimentação'],
    ['Supermercado Extra', 'alimentação'],
    ['Padaria', 'alimentação'],
    ['iFood', 'restaurante'],
    ['café', 'restaurante'],
    ['almoço com a equipe', 'restaurante'],
    ['Uber', 'transporte'],
    ['99 pro aeroporto', 'transporte'],
    ['gasolina', 'transporte'],
    ['Farmácia', 'saúde'],
    ['remédio', 'saúde'],
    ['cinema', 'lazer'],
    ['Amazon', 'compras'],
    ['ração do cachorro', 'casa'],
    ['botijão de gás', 'casa'],
    ['pão de queijo', 'outro'],
    ['', 'outro'],
  ])('%s → %s', (descricao, esperado) => {
    expect(inferirCategoria(descricao)).toBe(esperado)
  })

  it('palavra curta só casa inteira: "bar" não pega "barbearia"', () => {
    expect(inferirCategoria('barbearia')).toBe('outro')
  })

  it('empate fica com a categoria que vem antes', () => {
    expect(inferirCategoria('café no mercado')).toBe('alimentação')
  })
})

describe('normalizarCategoria', () => {
  it('aceita sem acento e maiúscula', () => {
    expect(normalizarCategoria('Saude')).toBe('saúde')
    expect(normalizarCategoria('alimentacao')).toBe('alimentação')
  })

  it('recusa o que não é categoria', () => {
    expect(normalizarCategoria('moradia')).toBeNull()
    expect(normalizarCategoria(3)).toBeNull()
  })
})

describe('extrairCategoria', () => {
  it('tira a hashtag de categoria', () => {
    expect(extrairCategoria('presente #lazer')).toEqual({ descricao: 'presente', categoria: 'lazer' })
  })

  it('hashtag que não é categoria fica no texto', () => {
    expect(extrairCategoria('festa #sextou')).toEqual({ descricao: 'festa #sextou', categoria: null })
  })

  it('só a primeira hashtag de categoria vale', () => {
    expect(extrairCategoria('#lazer x #casa')).toEqual({ descricao: 'x #casa', categoria: 'lazer' })
  })
})
