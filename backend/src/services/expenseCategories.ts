/**
 * Categorias dos gastos avulsos. Lista própria, separada da das contas: conta
 * fixa é moradia e assinatura, gasto do dia é mercado, café e uber.
 *
 * Há as padrão (chave fixa, abaixo) e as criadas pelo usuário (chave = id da
 * linha em expense_categories). A padrão pode ser renomeada, trocar de ícone e
 * ser ocultada — uma linha com base_key guarda isso —, mas não apagada.
 * expenses.category guarda sempre a chave, então renomear não mexe nos gastos.
 */
export const CATEGORIAS_GASTO = [
  'alimentação',
  'restaurante',
  'transporte',
  'saúde',
  'lazer',
  'compras',
  'casa',
  'outro',
] as const

export type CategoriaPadrao = (typeof CATEGORIAS_GASTO)[number]

/** Para onde vão os gastos sem pista ou de categoria apagada. Não pode ser ocultada. */
export const CATEGORIA_RESERVA: CategoriaPadrao = 'outro'

export const PADRAO: Record<CategoriaPadrao, { nome: string; icone: string }> = {
  'alimentação': { nome: 'Alimentação', icone: 'shopping_cart' },
  restaurante: { nome: 'Restaurante', icone: 'restaurant' },
  transporte: { nome: 'Transporte', icone: 'directions_car' },
  'saúde': { nome: 'Saúde', icone: 'medication' },
  lazer: { nome: 'Lazer', icone: 'celebration' },
  compras: { nome: 'Compras', icone: 'shopping_bag' },
  casa: { nome: 'Casa', icone: 'home' },
  outro: { nome: 'Outro', icone: 'more_horiz' },
}

/**
 * Ícones que o usuário pode escolher. Lista fechada porque a fonte de ícones é
 * por ligature: nome fora dela viraria texto cru na tela.
 * O frontend espelha esta lista em src/utils/categoriasGasto.ts.
 */
export const ICONES_CATEGORIA = [
  'shopping_cart', 'restaurant', 'directions_car', 'medication', 'celebration',
  'shopping_bag', 'home', 'more_horiz', 'pets', 'child_care', 'school',
  'fitness_center', 'local_cafe', 'local_bar', 'flight', 'checkroom', 'spa',
  'sports_esports', 'redeem', 'build', 'savings', 'work', 'favorite', 'devices',
] as const

export const ehPadrao = (key: string): key is CategoriaPadrao =>
  (CATEGORIAS_GASTO as readonly string[]).includes(key)

/** Linha de expense_categories como vem do banco. */
export interface LinhaCategoria {
  id: string
  base_key: string | null
  name: string
  icon: string
  hidden: number | boolean
}

export interface CategoriaDoUsuario {
  key: string
  nome: string
  icone: string
  padrao: boolean
  oculta: boolean
}

/** As 8 padrão na ordem fixa (com o que o usuário mudou nelas) e depois as dele, por nome. */
export function montarCategorias(linhas: LinhaCategoria[]): CategoriaDoUsuario[] {
  const ajustes = new Map(linhas.filter((l) => l.base_key).map((l) => [l.base_key as string, l]))
  const padrao = CATEGORIAS_GASTO.map((key) => {
    const a = ajustes.get(key)
    return {
      key,
      nome: a?.name || PADRAO[key].nome,
      icone: a?.icon || PADRAO[key].icone,
      padrao: true,
      oculta: key !== CATEGORIA_RESERVA && !!a?.hidden,
    }
  })
  const proprias = linhas
    .filter((l) => !l.base_key)
    .map((l) => ({ key: l.id, nome: l.name, icone: l.icon, padrao: false, oculta: !!l.hidden }))
    .sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
  return [...padrao, ...proprias]
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const chaveDeBusca = (s: string): string => semAcento(s).replace(/[^a-z0-9]/g, '')

/**
 * Categoria visível pelo nome ou pela chave, sem ligar para acento, maiúscula
 * e espaço: "#saude" acha Saúde e "#filhos" acha "Filhos". O nome atual ganha
 * da chave — se Lazer virou "Diversão", "#diversao" funciona; "#lazer" também,
 * enquanto nenhuma outra categoria se chamar Lazer.
 */
export function acharCategoria(texto: unknown, categorias: CategoriaDoUsuario[]): CategoriaDoUsuario | null {
  if (typeof texto !== 'string') return null
  const alvo = chaveDeBusca(texto)
  if (!alvo) return null
  const visiveis = categorias.filter((c) => !c.oculta)
  return (
    visiveis.find((c) => chaveDeBusca(c.nome) === alvo) ??
    visiveis.find((c) => c.padrao && chaveDeBusca(c.key) === alvo) ??
    null
  )
}

// Palavras sem acento, comparadas com o início de cada palavra da descrição:
// "farmac" pega farmácia e farmacinha. A ordem das categorias decide empate —
// "café da manhã no mercado" fica em alimentação, que vem antes.
const PALAVRAS: Array<[CategoriaPadrao, string[]]> = [
  ['alimentação', ['mercado', 'supermercado', 'padaria', 'acougue', 'hortifruti', 'feira', 'sacolao', 'atacad', 'assai', 'carrefour', 'quitanda']],
  ['restaurante', ['restaurante', 'lanche', 'ifood', 'cafe', 'bar', 'pizza', 'hamburguer', 'burger', 'almoco', 'janta', 'jantar', 'delivery', 'sorvete', 'acai', 'cerveja', 'marmita']],
  ['transporte', ['uber', '99', 'taxi', 'gasolina', 'combustivel', 'etanol', 'posto', 'estacionamento', 'onibus', 'metro', 'pedagio', 'passagem', 'oficina', 'lavagem']],
  ['saúde', ['farmac', 'remedio', 'drogaria', 'medic', 'consulta', 'exame', 'dentista', 'hospital', 'academia', 'psicolog', 'terapia']],
  ['lazer', ['cinema', 'show', 'viagem', 'passeio', 'ingresso', 'jogo', 'teatro', 'festa', 'hotel', 'parque']],
  ['compras', ['roupa', 'loja', 'amazon', 'shopee', 'shein', 'presente', 'sapato', 'tenis', 'eletronic', 'livro']],
  ['casa', ['limpeza', 'material', 'conserto', 'manutencao', 'reforma', 'ferragem', 'gas', 'agua', 'movel', 'moveis', 'pet', 'racao']],
]

/**
 * Deduz a categoria padrão pela descrição; sem pista, 'outro'. Categoria
 * oculta não recebe gasto: a busca segue para a próxima que casar.
 */
export function inferirCategoria(descricao: string, ocultas: ReadonlySet<string> = new Set()): CategoriaPadrao {
  const palavras = semAcento(descricao).split(/[^a-z0-9]+/).filter(Boolean)
  for (const [categoria, chaves] of PALAVRAS) {
    if (ocultas.has(categoria)) continue
    const casa = palavras.some((p) =>
      chaves.some((c) => (c.length <= 3 ? p === c : p.startsWith(c))),
    )
    if (casa) return categoria
  }
  return CATEGORIA_RESERVA
}

/**
 * Tira um "#categoria" da descrição, se houver: "presente #lazer" →
 * { descricao: "presente", categoria: "lazer" }. Hashtag que não é categoria
 * fica no texto.
 */
export function extrairCategoria(
  descricao: string,
  categorias: CategoriaDoUsuario[],
): { descricao: string; categoria: string | null } {
  let categoria: string | null = null
  const resto = descricao
    .split(/\s+/)
    .filter((t) => {
      if (categoria || !t.startsWith('#')) return true
      const c = acharCategoria(t.slice(1), categorias)
      if (!c) return true
      categoria = c.key
      return false
    })
    .join(' ')
    .trim()
  return { descricao: resto, categoria }
}

/** Nome para mostrar; chave que não existe mais (categoria apagada) vira a reserva. */
export function nomeCategoria(key: string, categorias: CategoriaDoUsuario[]): string {
  return (categorias.find((c) => c.key === key) ?? categorias.find((c) => c.key === CATEGORIA_RESERVA))?.nome ?? PADRAO.outro.nome
}

/** Nome de categoria nova ou renomeada: 1 a 30 caracteres, sem repetir outra (ignorando acento e maiúscula). */
export function validarNomeCategoria(
  nome: unknown,
  categorias: CategoriaDoUsuario[],
  ignorarKey?: string,
): { nome: string } | { erro: string } {
  const limpo = typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : ''
  if (!limpo) return { erro: 'Informe o nome da categoria' }
  if (limpo.length > 30) return { erro: 'Nome com no máximo 30 caracteres' }
  const alvo = chaveDeBusca(limpo)
  if (!alvo) return { erro: 'O nome precisa ter letras ou números' }
  const repetida = categorias.find((c) => c.key !== ignorarKey && chaveDeBusca(c.nome) === alvo)
  if (repetida) return { erro: `Já existe a categoria "${repetida.nome}"` }
  return { nome: limpo }
}
