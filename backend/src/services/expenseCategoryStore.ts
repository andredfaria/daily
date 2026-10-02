import pool from '../db'
import { CategoriaDoUsuario, montarCategorias } from './expenseCategories'

/** Categorias de gasto do usuário: as padrão (com os ajustes dele) e as que ele criou. */
export async function carregarCategorias(userId: string): Promise<CategoriaDoUsuario[]> {
  const [linhas]: any = await pool.query(
    'SELECT id, base_key, name, icon, hidden FROM expense_categories WHERE user_id = ?',
    [userId],
  )
  return montarCategorias(linhas)
}

export const chavesOcultas = (categorias: CategoriaDoUsuario[]): Set<string> =>
  new Set(categorias.filter((c) => c.oculta).map((c) => c.key))
