import React from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer,
} from 'recharts'
import type { ProjectionResponse } from '../../types'
import { formatBRL } from '../../utils/format'

interface SpendingTrendChartProps {
  history: ProjectionResponse | null
  projection: ProjectionResponse | null
  loading: boolean
}

interface TrendPoint {
  label: string
  actual: number | null
  projected: number | null
  isCurrent?: boolean
}

export const SpendingTrendChart: React.FC<SpendingTrendChartProps> = ({ history, projection, loading }) => {
  const historyMonths = history?.meses ?? []
  const projectionMonths = projection?.meses ?? []

  const points: TrendPoint[] = historyMonths.map((m, i) => ({
    label: m.label,
    actual: m.total,
    projected: null,
    isCurrent: i === historyMonths.length - 1,
  }))

  if (points.length) {
    points[points.length - 1].projected = points[points.length - 1].actual
  }

  projectionMonths.slice(1).forEach((m) => {
    points.push({ label: m.label, actual: null, projected: m.total })
  })

  const currentLabel = points.find((p) => p.isCurrent)?.label
  const nextMonth = projectionMonths[1]

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <div className="flex items-start justify-between mb-1 flex-wrap gap-2">
        <h2 className="text-base font-semibold text-on-surface">Tendência de gastos</h2>
        <span className="flex items-center gap-3 text-[11px] text-on-surface-variant">
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded-full bg-primary inline-block" /> Realizado</span>
          <span className="flex items-center gap-1"><span className="w-3 h-0.5 rounded-full bg-primary/50 inline-block" style={{ backgroundImage: 'repeating-linear-gradient(90deg, #c0c1ff 0 3px, transparent 3px 6px)' }} /> Projeção</span>
        </span>
      </div>
      {nextMonth && (
        <p className="text-xs text-on-surface-variant mb-4">
          Você vai gastar ~{formatBRL(nextMonth.total)} em {nextMonth.label}.
        </p>
      )}
      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : points.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Sem dados suficientes.</p>
      ) : (
        <div className="w-full h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={points} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="trendActualFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c0c1ff" stopOpacity={0.35} />
                  <stop offset="100%" stopColor="#c0c1ff" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="trendProjectedFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#c0c1ff" stopOpacity={0.12} />
                  <stop offset="100%" stopColor="#c0c1ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#464554" strokeOpacity={0.3} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#c7c4d7' }} axisLine={{ stroke: '#464554' }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#c7c4d7' }} width={48} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(value: any) => formatBRL(Number(value))}
                contentStyle={{ background: '#1f1f25', border: '1px solid #464554', borderRadius: 12, fontSize: 12 }}
                labelStyle={{ color: '#e4e1e9' }}
              />
              {currentLabel && (
                <ReferenceLine
                  x={currentLabel}
                  stroke="#908fa0"
                  strokeDasharray="3 3"
                  label={{ value: 'hoje', position: 'insideTopRight', fill: '#c7c4d7', fontSize: 10 }}
                />
              )}
              <Area
                type="monotone"
                dataKey="actual"
                stroke="#c0c1ff"
                strokeWidth={2}
                fill="url(#trendActualFill)"
                connectNulls={false}
                isAnimationActive
              />
              <Area
                type="monotone"
                dataKey="projected"
                stroke="#c0c1ff"
                strokeWidth={2}
                strokeDasharray="5 5"
                fill="url(#trendProjectedFill)"
                connectNulls={false}
                isAnimationActive
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  )
}
