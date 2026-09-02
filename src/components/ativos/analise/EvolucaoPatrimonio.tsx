import React from 'react'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import type { AssetHistoryPoint } from '../../../types'
import { formatBRL, formatDate } from '../../../utils/format'

interface Props {
  pontos: AssetHistoryPoint[]
  desde: string | null
}

export const EvolucaoPatrimonio: React.FC<Props> = ({ pontos, desde }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
    <h3 className="text-base font-semibold text-on-surface mb-4">Evolução do patrimônio</h3>

    {/* Um ponto só não é uma linha. Até acumular dias, dizer isso é mais útil
        que desenhar um gráfico degenerado. */}
    {pontos.length < 2 ? (
      <div className="py-10 text-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">timeline</span>
        <p className="text-sm text-on-surface-variant">
          {desde
            ? `Coletando desde ${formatDate(desde)} · volte em alguns dias`
            : 'A coleta começa no próximo horário de alerta de ativos'}
        </p>
      </div>
    ) : (
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={pontos} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gradPatrimonio" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#c0c1ff" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#c0c1ff" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#35343a" vertical={false} />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => formatDate(d, 'dd/MM')}
              tick={{ fontSize: 11, fill: '#a9a8b3' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
              tick={{ fontSize: 11, fill: '#a9a8b3' }}
              axisLine={false}
              tickLine={false}
              width={38}
            />
            <Tooltip
              formatter={(valor: any, nome: any) => [
                formatBRL(Number(valor)),
                nome === 'current_value' ? 'Patrimônio' : 'Custo',
              ]}
              labelFormatter={(d: any) => formatDate(String(d))}
              contentStyle={{ background: '#1f1f25', border: 'none', borderRadius: 12, fontSize: 12 }}
            />
            <Area type="monotone" dataKey="invested_value" stroke="#7a7986" fill="none" strokeDasharray="4 4" strokeWidth={1.5} />
            <Area type="monotone" dataKey="current_value" stroke="#c0c1ff" fill="url(#gradPatrimonio)" strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    )}
  </div>
)
