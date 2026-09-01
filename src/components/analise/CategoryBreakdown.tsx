import React from 'react'
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { ByCategoryResponse } from '../../types'
import { categoryColor, categoryLabel } from '../../utils/categoryColors'
import { formatBRL } from '../../utils/format'

interface CategoryBreakdownProps {
  data: ByCategoryResponse | null
  loading: boolean
}

export const CategoryBreakdown: React.FC<CategoryBreakdownProps> = ({ data, loading }) => {
  const pieData = (data?.categorias ?? []).map((c) => ({
    name: categoryLabel(c.category),
    value: c.total,
    color: categoryColor(c.category),
    pct: c.pct,
  }))

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <h2 className="text-base font-semibold text-on-surface mb-4">Gastos por categoria (mês atual)</h2>
      {loading ? (
        <p className="text-sm text-on-surface-variant">Carregando…</p>
      ) : pieData.length === 0 ? (
        <p className="text-sm text-on-surface-variant">Nenhuma conta neste período.</p>
      ) : (
        <div className="flex flex-col sm:flex-row items-center gap-6">
          <div className="relative w-full sm:w-1/2 h-56 flex-shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                  {pieData.map((d, i) => <Cell key={i} fill={d.color} stroke="none" />)}
                </Pie>
                <Tooltip
                  formatter={(value: any) => formatBRL(Number(value))}
                  contentStyle={{ background: '#1f1f25', border: '1px solid #464554', borderRadius: 12, fontSize: 12 }}
                  labelStyle={{ color: '#e4e1e9' }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-lg font-bold text-on-surface">{formatBRL(data?.total ?? 0)}</span>
              <span className="text-[10px] text-on-surface-variant">total</span>
            </div>
          </div>
          <ul className="w-full sm:w-1/2 space-y-2.5">
            {pieData.map((d, i) => (
              <li key={i} className="space-y-1">
                <div className="flex items-center justify-between text-sm gap-2">
                  <span className="flex items-center gap-2 text-on-surface min-w-0 truncate">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="text-on-surface-variant text-xs flex-shrink-0">{formatBRL(d.value)} · {d.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-outline-variant/20 overflow-hidden">
                  <div
                    className="h-1.5 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(d.pct, 100)}%`, backgroundColor: d.color }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
