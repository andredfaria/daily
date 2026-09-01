import React from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface HistoryDay {
  poll_date: string
  completion_pct: number
}

interface WeeklyTrendSparklineProps {
  history: HistoryDay[]
}

const toDateStr = (v: unknown): string => {
  if (!v) return ''
  if (v instanceof Date) return v.toISOString().slice(0, 10)
  return String(v).slice(0, 10)
}

function weekStart(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

function weekLabel(dateStr: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', day: '2-digit', month: '2-digit' }).format(
    new Date(dateStr + 'T00:00:00'),
  )
}

export const WeeklyTrendSparkline: React.FC<WeeklyTrendSparklineProps> = ({ history }) => {
  const buckets = new Map<string, { sum: number; count: number }>()
  history.forEach((h) => {
    const ds = toDateStr(h.poll_date)
    if (!ds) return
    const wk = weekStart(ds)
    const b = buckets.get(wk) ?? { sum: 0, count: 0 }
    b.sum += Number(h.completion_pct)
    b.count += 1
    buckets.set(wk, b)
  })

  const weeks = Array.from(buckets.entries())
    .map(([week, { sum, count }]) => ({ week, label: weekLabel(week), pct: Math.round(sum / count) }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-12)

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <h3 className="text-base font-semibold text-on-surface mb-1">Tendência semanal</h3>
      <p className="text-xs text-on-surface-variant mb-4">Conclusão média por semana (últimas 12 semanas)</p>
      {weeks.length < 2 ? (
        <p className="text-sm text-on-surface-variant">Dados insuficientes para exibir a tendência.</p>
      ) : (
        <div className="w-full h-32">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={weeks} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="weeklyTrendFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#4ae176" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#4ae176" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#c7c4d7' }} axisLine={false} tickLine={false} />
              <YAxis domain={[0, 100]} hide />
              <Tooltip
                formatter={(value: any) => [`${value}%`, 'Conclusão média']}
                contentStyle={{ background: '#1f1f25', border: '1px solid #464554', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#e4e1e9' }}
              />
              <Area
                type="monotone"
                dataKey="pct"
                stroke="#4ae176"
                strokeWidth={2}
                fill="url(#weeklyTrendFill)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
