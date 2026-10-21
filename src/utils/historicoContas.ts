/**
 * Regras puras da aba Histórico de Contas.
 */
import type { FechamentoContasResponse, ItemFechamentoContas } from '../types'

/** Mês corrente (YYYY-MM) no relógio do aparelho. */
export const mesLocal = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

/** Soma (ou subtrai) meses de um YYYY-MM. */
export const somarMeses = (mes: string, n: number): string => {
  const [a, m] = mes.split('-').map(Number)
  const d = new Date(a, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export interface ContaDoMes extends ItemFechamentoContas {
  category: string
}

/**
 * Separa as contas do mês em "falta pagar" e "pagas", tirando-as dos grupos
 * por categoria. Falta pagar: atrasadas primeiro, depois por vencimento.
 * Pagas: a mais recente primeiro.
 */
export const separarContasDoMes = (
  fechamento: FechamentoContasResponse,
): { faltaPagar: ContaDoMes[]; pagas: ContaDoMes[] } => {
  const todas = fechamento.categorias.flatMap((c) => c.itens.map((i) => ({ ...i, category: c.category })))
  const faltaPagar = todas
    .filter((i) => i.situacao !== 'paga')
    .sort((a, b) =>
      Number(b.situacao === 'atrasada') - Number(a.situacao === 'atrasada')
      || a.due_date.localeCompare(b.due_date)
      || a.bill_name.localeCompare(b.bill_name, 'pt-BR'))
  const pagas = todas
    .filter((i) => i.situacao === 'paga')
    .sort((a, b) => (b.paid_at ?? '').localeCompare(a.paid_at ?? '') || a.bill_name.localeCompare(b.bill_name, 'pt-BR'))
  return { faltaPagar, pagas }
}
