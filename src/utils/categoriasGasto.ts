/**
 * Categorias do sistema todo — gastos avulsos e contas usam a mesma lista.
 * Vêm da API (GET /api/expenses/categories): as padrão, com o que o usuário
 * renomeou/ocultou, e as que ele criou. Nas telas, carregue por `useCategorias`.
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
  'subscriptions', 'bolt', 'wifi', 'credit_card', 'receipt_long', 'shield',
]

/**
 * As padrão sem ajuste do usuário, na ordem do backend (CATEGORIAS_GASTO).
 * Servem enquanto a API não respondeu, para o seletor não abrir vazio.
 */
export const CATEGORIAS_PADRAO: CategoriaGasto[] = [
  ['alimentação', 'Alimentação', 'shopping_cart'],
  ['restaurante', 'Restaurante', 'restaurant'],
  ['transporte', 'Transporte', 'directions_car'],
  ['saúde', 'Saúde', 'medication'],
  ['lazer', 'Lazer', 'celebration'],
  ['compras', 'Compras', 'shopping_bag'],
  ['casa', 'Casa', 'home'],
  ['assinaturas', 'Assinaturas', 'subscriptions'],
  ['serviços', 'Serviços', 'bolt'],
  ['educação', 'Educação', 'school'],
  ['outro', 'Outro', 'more_horiz'],
].map(([key, nome, icone]) => ({ key, nome, icone, padrao: true, oculta: false }))

const RESERVA: CategoriaGasto = { key: 'outro', nome: 'Outro', icone: 'more_horiz', padrao: true, oculta: false }

/** Categoria de um gasto; chave que não existe mais cai em "outro", como no backend. */
export const infoCategoria = (key: string, categorias: CategoriaGasto[]): CategoriaGasto =>
  categorias.find((c) => c.key === key) ?? categorias.find((c) => c.key === 'outro') ?? RESERVA
