import { useEffect, useState } from 'react'
import { expensesApi } from '../api/expenses'
import { CATEGORIAS_PADRAO, type CategoriaGasto } from '../utils/categoriasGasto'

// Cache do módulo: Contas, Gastos e a análise leem a mesma lista sem refazer
// a requisição a cada troca de página, e quem edita (Gastos › Gerenciar)
// avisa as outras telas por `definirCategorias`.
let cache: CategoriaGasto[] | null = null
let pendente: Promise<CategoriaGasto[]> | null = null
const ouvintes = new Set<(c: CategoriaGasto[]) => void>()

export function definirCategorias(lista: CategoriaGasto[]): void {
  cache = lista
  ouvintes.forEach((fn) => fn(lista))
}

function carregar(): Promise<CategoriaGasto[]> {
  pendente ??= expensesApi
    .categorias()
    .then((lista) => {
      definirCategorias(lista)
      return lista
    })
    .finally(() => {
      pendente = null
    })
  return pendente
}

/**
 * Categorias do usuário (as mesmas para contas e gastos). Devolve as padrão
 * enquanto a API não respondeu; se ela falhar, ficam as padrão.
 */
export function useCategorias(): CategoriaGasto[] {
  const [lista, setLista] = useState<CategoriaGasto[]>(cache ?? CATEGORIAS_PADRAO)
  useEffect(() => {
    ouvintes.add(setLista)
    if (!cache) carregar().catch(() => undefined)
    return () => {
      ouvintes.delete(setLista)
    }
  }, [])
  return lista
}
