import React, { useEffect, useState } from 'react'
import {
  PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { analyticsApi } from '../api/analytics'
import type { ByCategoryResponse, ProjectionResponse } from '../types'
import { categoryColor, categoryLabel } from '../utils/categoryColors'
import { formatBRL } from '../utils/format'
import { useToast } from '../context/ToastContext'

type Periodo = 'atual' | 'proximo'

function periodoRange(p: Periodo): { from: string; to: string } {
  const now = new Date()
  const offset = p === 'proximo' ? 1 : 0
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0)
  const toStr = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  return { from: toStr(first), to: toStr(last) }
}

const Analise: React.FC = () => {
  const { showToast } = useToast()
  const [periodo, setPeriodo] = useState<Periodo>('atual')
  const [byCat, setByCat] = useState<ByCategoryResponse | null>(null)
  const [projection, setProjection] = useState<ProjectionResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    setLoading(true)
    const { from, to } = periodoRange(periodo)
    Promise.all([analyticsApi.byCategory(from, to), analyticsApi.projection(6)])
      .then(([cat, proj]) => {
        if (!active) return
        setByCat(cat)
        setProjection(proj)
      })
      .catch(() => { if (active) showToast('Erro ao carregar análise', 'error') })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [periodo, showToast])

  const pieData = (byCat?.categorias ?? []).map((c) => ({
    name: categoryLabel(c.category),
    value: c.total,
    color: categoryColor(c.category),
    pct: c.pct,
  }))

  const barData = (projection?.meses ?? []).map((m) => ({ label: m.label, total: m.total }))
  const proximoMes = projection?.meses?.[1]

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold text-on-surface">Análise</h1>
        <p className="text-sm text-on-surface-variant">Visão dos seus gastos por categoria e projeção futura.</p>
      </header>

      <div className="flex gap-2">
        {(['atual', 'proximo'] as Periodo[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriodo(p)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              periodo === p ? 'bg-primary text-on-primary' : 'bg-surface-container text-on-surface-variant'
            }`}
          >
            {p === 'atual' ? 'Mês atual' : 'Próximo mês'}
          </button>
        ))}
      </div>

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-4">Gastos por categoria</h2>
        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : pieData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Nenhuma conta neste período.</p>
        ) : (
          <div className="flex flex-col sm:flex-row items-center gap-6">
            <div className="w-full sm:w-1/2 h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {pieData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="w-full sm:w-1/2 space-y-2">
              {pieData.map((d, i) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-2 text-on-surface">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: d.color }} />
                    {d.name}
                  </span>
                  <span className="text-on-surface-variant">{formatBRL(d.value)} · {d.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
        <h2 className="text-base font-semibold text-on-surface mb-1">Projeção dos próximos meses</h2>
        {proximoMes && (
          <p className="text-sm text-on-surface-variant mb-4">
            Você vai gastar ~{formatBRL(proximoMes.total)} em {proximoMes.label}.
          </p>
        )}
        {loading ? (
          <p className="text-sm text-on-surface-variant">Carregando…</p>
        ) : barData.length === 0 ? (
          <p className="text-sm text-on-surface-variant">Sem dados de projeção.</p>
        ) : (
          <div className="w-full h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                <Bar dataKey="total" fill="#6750A4" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  )
}

export default Analise
