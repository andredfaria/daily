import React from 'react'

interface HistoryDay {
  poll_date: string
  completion_pct: number
  selected_options: string[] | null
}

interface ChecklistHeatmapProps {
  history: HistoryDay[]
  itemText: string
  days?: number
  showLegend?: boolean
}

export type ItemDayState = 'empty' | 'unchecked' | 'checked'

const DAY_ROWS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
// Como no GitHub, só dias alternados ganham rótulo — a grade fica legível sem apertar.
const DAY_ROWS_VISIBLE = new Set([1, 3, 5])

// Um item por grade: cinza apagado quando não houve envio, cinza forte quando o
// poll saiu e o item ficou sem marcar, verde (`tertiary`) quando foi marcado.
const STATE_CLASS: Record<ItemDayState, string> = {
  empty: 'bg-surface-container-high/50',
  unchecked: 'bg-surface-container-highest',
  checked: 'bg-tertiary',
}

const STATE_LABEL: Record<ItemDayState, string> = {
  empty: 'Sem envio',
  unchecked: 'Não marcado',
  checked: 'Marcado',
}

const LEGEND_ORDER: ItemDayState[] = ['empty', 'unchecked', 'checked']

// MySQL2 retorna colunas DATE como objetos Date — normaliza para string YYYY-MM-DD
export const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

// O item conta como marcado pelo texto, a mesma regra do ranking: renomear o
// item deixa o histórico anterior sob o nome antigo.
export function estadoDoItem(dia: HistoryDay | undefined, itemText: string): ItemDayState {
  if (!dia) return 'empty'
  return (dia.selected_options ?? []).includes(itemText) ? 'checked' : 'unchecked'
}

export function resumirItem(history: HistoryDay[], itemText: string): { marcados: number; enviados: number } {
  const porDia = new Map<string, HistoryDay>()
  history.forEach((h) => porDia.set(toDateStr(h.poll_date), h))
  let marcados = 0
  porDia.forEach((dia) => { if (estadoDoItem(dia, itemText) === 'checked') marcados++ })
  return { marcados, enviados: porDia.size }
}

// Resumo da janela para o cabeçalho do card: quantos dias fecharam 100% e em
// quantos houve envio.
export function resumirHistorico(history: HistoryDay[]): { completos: number; enviados: number } {
  const porDia = new Map<string, number>()
  history.forEach((h) => porDia.set(toDateStr(h.poll_date), Number(h.completion_pct)))
  let completos = 0
  porDia.forEach((pct) => { if (pct >= 100) completos++ })
  return { completos, enviados: porDia.size }
}

const formatDate = (dateStr: string) =>
  new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(new Date(dateStr + 'T00:00:00Z'))

export const HeatmapLegend: React.FC = () => (
  <div className="flex items-center justify-end gap-1 text-[11px] text-on-surface-variant">
    {LEGEND_ORDER.map((e) => (
      <span key={e} className="flex items-center gap-1 ml-2 first:ml-0">
        <span className={`h-3 w-3 rounded-[3px] ${STATE_CLASS[e]}`} />
        {STATE_LABEL[e]}
      </span>
    ))}
  </div>
)

export const ChecklistHeatmap: React.FC<ChecklistHeatmapProps> = ({ history, itemText, days = 84, showLegend = true }) => {
  const diaPorData = new Map<string, HistoryDay>()
  history.forEach((h) => diaPorData.set(toDateStr(h.poll_date), h))

  // Gera os últimos `days` dias corridos (mais antigo primeiro), ancorados em hoje.
  const dates: string[] = []
  const cursor = new Date()
  cursor.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(cursor)
    d.setDate(d.getDate() - i)
    dates.push(d.toISOString().slice(0, 10))
  }
  const hoje = dates[dates.length - 1]

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

  let lastMonth = ''
  const monthLabels = columns.map((week) => {
    const first = week.find((d) => d !== null)
    if (!first) return ''
    const m = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', month: 'short' })
      .format(new Date(first + 'T00:00:00Z'))
      .replace('.', '')
    if (m === lastMonth) return ''
    lastMonth = m
    return m
  })

  const { marcados, enviados } = resumirItem(history, itemText)

  return (
    <div>
      <div
        role="img"
        aria-label={`${itemText}: marcado em ${marcados} de ${enviados} dias com envio nas últimas ${days / 7} semanas.`}
        className="overflow-x-auto pb-1 no-scrollbar"
      >
        <div className="inline-flex flex-col">
          <div className="flex gap-[3px] mb-1 pl-8">
            {monthLabels.map((m, i) => (
              <div key={i} className="w-3.5 text-[11px] leading-none text-on-surface-variant flex-shrink-0 capitalize whitespace-nowrap">
                {m}
              </div>
            ))}
          </div>
          <div className="flex gap-[3px]">
            <div className="flex flex-col gap-[3px] w-8 flex-shrink-0">
              {DAY_ROWS.map((label, i) => (
                <div key={label} className="h-3.5 text-[11px] leading-none text-on-surface-variant flex items-center">
                  {DAY_ROWS_VISIBLE.has(i) ? label : ''}
                </div>
              ))}
            </div>
            {columns.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px] flex-shrink-0">
                {week.map((dateStr, di) => {
                  if (!dateStr) return <div key={di} className="h-3.5 w-3.5" />
                  const estado = estadoDoItem(diaPorData.get(dateStr), itemText)
                  const ehHoje = dateStr === hoje
                  return (
                    <div
                      key={di}
                      title={`${formatDate(dateStr)} — ${STATE_LABEL[estado].toLowerCase()}`}
                      className={`h-3.5 w-3.5 rounded-[3px] ${STATE_CLASS[estado]} ${
                        ehHoje ? 'ring-1 ring-on-surface/70 ring-offset-1 ring-offset-surface' : ''
                      }`}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
      {showLegend && (
        <div className="mt-3">
          <HeatmapLegend />
        </div>
      )}
    </div>
  )
}
