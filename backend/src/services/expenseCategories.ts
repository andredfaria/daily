/**
 * Categorias dos gastos avulsos. Lista própria, separada da das contas: conta
 * fixa é moradia e assinatura, gasto do dia é mercado, café e uber.
 * O frontend espelha esta lista em src/utils/categoriasGasto.ts.
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

export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number]

export const ROTULO_CATEGORIA: Record<CategoriaGasto, string> = {
  'alimentação': 'Alimentação',
  restaurante: 'Restaurante',
  transporte: 'Transporte',
  'saúde': 'Saúde',
  lazer: 'Lazer',
  compras: 'Compras',
  casa: 'Casa',
  outro: 'Outro',
}

const semAcento = (s: string): string => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Aceita com ou sem acento ("saude" → "saúde"); devolve null se não for categoria. */
export function normalizarCategoria(valor: unknown): CategoriaGasto | null {
  if (typeof valor !== 'string') return null
  const alvo = semAcento(valor.trim())
  return CATEGORIAS_GASTO.find((c) => semAcento(c) === alvo) ?? null
}

// Palavras sem acento, comparadas com o início de cada palavra da descrição:
// "farmac" pega farmácia e farmacinha. A ordem das categorias decide empate —
// "café da manhã no mercado" fica em alimentação, que vem antes.
const PALAVRAS: Array<[CategoriaGasto, string[]]> = [
  ['alimentação', ['mercado', 'supermercado', 'padaria', 'acougue', 'hortifruti', 'feira', 'sacolao', 'atacad', 'assai', 'carrefour', 'quitanda']],
  ['restaurante', ['restaurante', 'lanche', 'ifood', 'cafe', 'bar', 'pizza', 'hamburguer', 'burger', 'almoco', 'janta', 'jantar', 'delivery', 'sorvete', 'acai', 'cerveja', 'marmita']],
  ['transporte', ['uber', '99', 'taxi', 'gasolina', 'combustivel', 'etanol', 'posto', 'estacionamento', 'onibus', 'metro', 'pedagio', 'passagem', 'oficina', 'lavagem']],
  ['saúde', ['farmac', 'remedio', 'drogaria', 'medic', 'consulta', 'exame', 'dentista', 'hospital', 'academia', 'psicolog', 'terapia']],
  ['lazer', ['cinema', 'show', 'viagem', 'passeio', 'ingresso', 'jogo', 'teatro', 'festa', 'hotel', 'parque']],
  ['compras', ['roupa', 'loja', 'amazon', 'shopee', 'shein', 'presente', 'sapato', 'tenis', 'eletronic', 'livro']],
  ['casa', ['limpeza', 'material', 'conserto', 'manutencao', 'reforma', 'ferragem', 'gas', 'agua', 'movel', 'moveis', 'pet', 'racao']],
]

/** Deduz a categoria pela descrição; sem pista, 'outro'. */
export function inferirCategoria(descricao: string): CategoriaGasto {
  const palavras = semAcento(descricao).split(/[^a-z0-9]+/).filter(Boolean)
  for (const [categoria, chaves] of PALAVRAS) {
    const casa = palavras.some((p) =>
      chaves.some((c) => (c.length <= 3 ? p === c : p.startsWith(c))),
    )
    if (casa) return categoria
  }
  return 'outro'
}

/**
 * Tira um "#categoria" da descrição, se houver: "presente #lazer" →
 * { descricao: "presente", categoria: "lazer" }. Hashtag que não é categoria
 * fica no texto.
 */
export function extrairCategoria(descricao: string): { descricao: string; categoria: CategoriaGasto | null } {
  let categoria: CategoriaGasto | null = null
  const resto = descricao
    .split(/\s+/)
    .filter((t) => {
      if (categoria || !t.startsWith('#')) return true
      const c = normalizarCategoria(t.slice(1))
      if (!c) return true
      categoria = c
      return false
    })
    .join(' ')
    .trim()
  return { descricao: resto, categoria }
}
