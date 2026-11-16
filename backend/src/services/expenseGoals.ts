// Metas de gasto por período (viagem, feriado): validação pura, sem banco.

export interface DadosMeta {
  name: string
  start_date: string
  end_date: string
  amount: number
}

/** Período longo demais vira limite mensal disfarçado; um ano é folga suficiente. */
export const MAX_DIAS_META = 366

const dataValida = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false
  const [a, m, d] = v.split('-').map(Number)
  const dt = new Date(Date.UTC(a, m - 1, d))
  return dt.getUTCFullYear() === a && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d
}

const diasEntre = (inicio: string, fim: string) =>
  Math.round((Date.parse(`${fim}T00:00:00Z`) - Date.parse(`${inicio}T00:00:00Z`)) / 86_400_000)

export function validarMeta(body: any): DadosMeta | { erro: string } {
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  if (!name) return { erro: 'Informe o nome da meta.' }
  if (name.length > 60) return { erro: 'Nome da meta com no máximo 60 caracteres.' }

  const { start_date, end_date } = body
  if (!dataValida(start_date) || !dataValida(end_date)) return { erro: 'Datas devem estar no formato YYYY-MM-DD.' }
  if (end_date < start_date) return { erro: 'O fim não pode ser antes do início.' }
  if (diasEntre(start_date, end_date) + 1 > MAX_DIAS_META) return { erro: `Período de no máximo ${MAX_DIAS_META} dias.` }

  const amount = Number(body.amount)
  if (!Number.isFinite(amount) || amount <= 0) return { erro: 'Informe o valor da meta.' }
  if (amount >= 100_000_000) return { erro: 'Valor alto demais.' }

  return { name, start_date, end_date, amount: Math.round(amount * 100) / 100 }
}
