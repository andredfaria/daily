/**
 * Categorias dos gastos avulsos. Espelha backend/src/services/expenseCategories.ts —
 * ao mudar a lista lá (inclusive as palavras que deduzem a categoria), atualizar aqui.
 */
export type CategoriaGasto =
  | 'alimentação'
  | 'restaurante'
  | 'transporte'
  | 'saúde'
  | 'lazer'
  | 'compras'
  | 'casa'
  | 'outro'

export const CATEGORIAS_GASTO: Array<{ valor: CategoriaGasto; rotulo: string; icone: string }> = [
  { valor: 'alimentação', rotulo: 'Alimentação', icone: 'shopping_cart' },
  { valor: 'restaurante', rotulo: 'Restaurante', icone: 'restaurant' },
  { valor: 'transporte', rotulo: 'Transporte', icone: 'directions_car' },
  { valor: 'saúde', rotulo: 'Saúde', icone: 'medication' },
  { valor: 'lazer', rotulo: 'Lazer', icone: 'celebration' },
  { valor: 'compras', rotulo: 'Compras', icone: 'shopping_bag' },
  { valor: 'casa', rotulo: 'Casa', icone: 'home' },
  { valor: 'outro', rotulo: 'Outro', icone: 'more_horiz' },
]

const OUTRO = CATEGORIAS_GASTO[CATEGORIAS_GASTO.length - 1]

export const infoCategoria = (valor: string) => CATEGORIAS_GASTO.find((c) => c.valor === valor) ?? OUTRO
