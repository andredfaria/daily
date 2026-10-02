import {
  acharCategoria,
  extrairCategoria,
  inferirCategoria,
  montarCategorias,
  nomeCategoria,
  validarNomeCategoria,
  LinhaCategoria,
} from '../expenseCategories'

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

  it('pula categoria oculta e segue para a próxima que casa', () => {
    expect(inferirCategoria('café no mercado', new Set(['alimentação']))).toBe('restaurante')
    expect(inferirCategoria('mercado', new Set(['alimentação']))).toBe('outro')
  })
})

const linhas: LinhaCategoria[] = [
  { id: 'x1', base_key: 'lazer', name: 'Diversão', icon: 'sports_esports', hidden: 0 },
  { id: 'x2', base_key: 'casa', name: 'Casa', icon: 'home', hidden: 1 },
  { id: 'x3', base_key: 'outro', name: 'Outro', icon: 'more_horiz', hidden: 1 },
  { id: 'uuid-pet', base_key: null, name: 'Pet', icon: 'pets', hidden: 0 },
  { id: 'uuid-filhos', base_key: null, name: 'Filhos', icon: 'child_care', hidden: 0 },
]
const cats = montarCategorias(linhas)

describe('montarCategorias', () => {
  it('padrão na ordem fixa, depois as criadas por nome', () => {
    expect(cats.map((c) => c.key)).toEqual([
      'alimentação', 'restaurante', 'transporte', 'saúde', 'lazer', 'compras', 'casa', 'outro', 'uuid-filhos', 'uuid-pet',
    ])
  })

  it('aplica nome, ícone e oculta das padrão', () => {
    expect(cats.find((c) => c.key === 'lazer')).toMatchObject({ nome: 'Diversão', icone: 'sports_esports', padrao: true })
    expect(cats.find((c) => c.key === 'casa')!.oculta).toBe(true)
  })

  it('"outro" nunca fica oculta', () => {
    expect(cats.find((c) => c.key === 'outro')!.oculta).toBe(false)
  })

  it('sem linhas, só as padrão', () => {
    expect(montarCategorias([])).toHaveLength(8)
  })
})

describe('acharCategoria', () => {
  it('pelo nome, sem acento nem maiúscula', () => {
    expect(acharCategoria('saude', cats)!.key).toBe('saúde')
    expect(acharCategoria('PET', cats)!.key).toBe('uuid-pet')
  })

  it('padrão renomeada atende pelo nome novo e pelo antigo', () => {
    expect(acharCategoria('diversao', cats)!.key).toBe('lazer')
    expect(acharCategoria('lazer', cats)!.key).toBe('lazer')
  })

  it('oculta não é achada', () => {
    expect(acharCategoria('casa', cats)).toBeNull()
  })

  it('nome com espaço casa sem o espaço', () => {
    const c = montarCategorias([{ id: 'u', base_key: null, name: 'Material escolar', icon: 'school', hidden: 0 }])
    expect(acharCategoria('materialescolar', c)!.key).toBe('u')
  })
})

describe('extrairCategoria', () => {
  it('tira a hashtag de categoria', () => {
    expect(extrairCategoria('presente #lazer', cats)).toEqual({ descricao: 'presente', categoria: 'lazer' })
    expect(extrairCategoria('ração #pet', cats)).toEqual({ descricao: 'ração', categoria: 'uuid-pet' })
  })

  it('hashtag que não é categoria fica no texto', () => {
    expect(extrairCategoria('festa #sextou', cats)).toEqual({ descricao: 'festa #sextou', categoria: null })
  })

  it('só a primeira hashtag de categoria vale', () => {
    expect(extrairCategoria('#lazer x #pet', cats)).toEqual({ descricao: 'x #pet', categoria: 'lazer' })
  })
})

describe('nomeCategoria', () => {
  it('chave apagada vira a reserva', () => {
    expect(nomeCategoria('uuid-pet', cats)).toBe('Pet')
    expect(nomeCategoria('uuid-que-sumiu', cats)).toBe('Outro')
  })
})

describe('validarNomeCategoria', () => {
  it('limpa espaços', () => {
    expect(validarNomeCategoria('  Viagem   de  férias ', cats)).toEqual({ nome: 'Viagem de férias' })
  })

  it('recusa vazio, longo e repetido (inclusive oculta e sem acento)', () => {
    expect(validarNomeCategoria('  ', cats)).toHaveProperty('erro')
    expect(validarNomeCategoria('x'.repeat(31), cats)).toHaveProperty('erro')
    expect(validarNomeCategoria('pet', cats)).toHaveProperty('erro')
    expect(validarNomeCategoria('saude', cats)).toHaveProperty('erro')
    expect(validarNomeCategoria('Casa', cats)).toHaveProperty('erro')
  })

  it('renomear para o próprio nome não conta como repetido', () => {
    expect(validarNomeCategoria('Pet', cats, 'uuid-pet')).toEqual({ nome: 'Pet' })
  })
})
