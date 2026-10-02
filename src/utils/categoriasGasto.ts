/**
 * Categorias de gasto vêm da API (GET /api/expenses/categories): as padrão,
 * com o que o usuário renomeou/ocultou, e as que ele criou.
 */
export interface CategoriaGasto {
  /** Chave gravada no gasto: nome fixo na padrão, id na criada pelo usuário. */
  key: string
  nome: string
  icone: string
  padrao: boolean
  oculta: boolean
}

/**
 * Ícones que dá para escolher. Espelha ICONES_CATEGORIA em
 * backend/src/services/expenseCategories.ts — o backend recusa os demais.
 */
export const ICONES_CATEGORIA = [
  'shopping_cart', 'restaurant', 'directions_car', 'medication', 'celebration',
  'shopping_bag', 'home', 'more_horiz', 'pets', 'child_care', 'school',
  'fitness_center', 'local_cafe', 'local_bar', 'flight', 'checkroom', 'spa',
  'sports_esports', 'redeem', 'build', 'savings', 'work', 'favorite', 'devices',
]

const RESERVA: CategoriaGasto = { key: 'outro', nome: 'Outro', icone: 'more_horiz', padrao: true, oculta: false }

/** Categoria de um gasto; chave que não existe mais cai em "outro", como no backend. */
export const infoCategoria = (key: string, categorias: CategoriaGasto[]): CategoriaGasto =>
  categorias.find((c) => c.key === key) ?? categorias.find((c) => c.key === 'outro') ?? RESERVA
