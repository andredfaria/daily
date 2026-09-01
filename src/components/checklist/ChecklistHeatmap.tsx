import React from 'react'

interface HistoryDay {
  poll_date: string
  completion_pct: number
}

interface ChecklistHeatmapProps {
  history: HistoryDay[]
  days?: number
}

type Bucket = 'empty' | 'zero' | 'low' | 'mid' | 'full'

const DAY_ROWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const BUCKET_CLASS: Record<Bucket, string> = {
  empty: 'bg-surface-container',
  zero: 'bg-primary/15',
  low: 'bg-primary/40',
  mid: 'bg-primary/70',
  full: 'bg-tertiary',
}

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function pctToBucket(pct: number | undefined): Bucket {
  if (pct === undefined) return 'empty'
  if (pct === 0) return 'zero'
  if (pct < 51) return 'low'
  if (pct < 100) return 'mid'
  return 'full'
}

export const ChecklistHeatmap: React.FC<ChecklistHeatmapProps> = ({ history, days = 84 }) => {
  const pctByDate = new Map<string, number>()
  history.forEach((h) => pctByDate.set(toDateStr(h.poll_date), Number(h.completion_pct)))

  // Gera os últimos `days` dias corridos (mais antigo primeiro), ancorados em hoje.
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }

  // Alinha a primeira coluna ao domingo anterior à data mais antiga, pra grade ficar retangular.
  const firstDate = new Date(dates[0] + 'T00:00:00')
  const leadingBlanks = firstDate.getDay() // 0=Dom
  const cells: Array<string | null> = [...Array(leadingBlanks).fill(null), ...dates]
  const weekCount = Math.ceil(cells.length / 7)
  while (cells.length < weekCount * 7) cells.push(null)

  const columns: Array<Array<string | null>> = []
  for (let w = 0; w < weekCount; w++) {
    columns.push(cells.slice(w * 7, w * 7 + 7))
  }

  const formatDate = (dateStr: string) =>
    new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(new Date(dateStr + 'T00:00:00'))

  let lastMonth = ''
  const monthLabels = columns.map((week) => {
    const firstDate = week.find((d) => d !== null)
    if (!firstDate) return ''
    const m = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' }).format(new Date(firstDate + 'T00:00:00'))
    if (m === lastMonth) return ''
    lastMonth = m
    return m
  })

  return (
    <div>
      <div className="overflow-x-auto pb-1 no-scrollbar">
        <div className="flex gap-1 mb-1">
          <div className="w-7 mr-1 flex-shrink-0" />
          {monthLabels.map((m, i) => (
            <div key={i} className="w-3.5 text-[9px] text-on-surface-variant flex-shrink-0 capitalize whitespace-nowrap">
              {m}
            </div>
          ))}
        </div>
        <div className="flex gap-1">
          <div className="flex flex-col gap-1 mr-1 flex-shrink-0">
            {DAY_ROWS.map((label) => (
              <div key={label} className="h-3.5 w-7 text-[9px] text-on-surface-variant flex items-center justify-end pr-1">
                {label}
              </div>
            ))}
          </div>
          {columns.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1 flex-shrink-0">
              {week.map((dateStr, di) => {
                if (!dateStr) return <div key={di} className="h-3.5 w-3.5" />
                const pct = pctByDate.get(dateStr)
                const bucket = pctToBucket(pct)
                return (
                  <div
                    key={di}
                    title={`${formatDate(dateStr)} — ${pct !== undefined ? `${pct}%` : 'sem envio'}`}
                    className={`h-3.5 w-3.5 rounded-sm ${BUCKET_CLASS[bucket]}`}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3 mt-3 text-[10px] text-on-surface-variant flex-wrap">
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.empty}`} /> Sem envio</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.zero}`} /> 0%</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.low}`} /> 1–50%</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.mid}`} /> 51–99%</span>
        <span className="flex items-center gap-1"><span className={`h-3 w-3 rounded-sm ${BUCKET_CLASS.full}`} /> 100%</span>
      </div>
    </div>
  )
}
