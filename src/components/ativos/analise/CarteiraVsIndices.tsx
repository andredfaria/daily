import React from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import type { AssetBenchmarkResponse } from '../../../types'
import { formatDate } from '../../../utils/format'

// Mesma paleta da alocação: lavanda é a carteira (primary), menta e amarelo
// ficam para as referências. Recharts precisa de hex literal.
const SERIES = [
  { chave: 'carteira', rotulo: 'Carteira', cor: '#c0c1ff' },
  { chave: 'cdi', rotulo: 'CDI', cor: '#7fd8a0' },
  { chave: 'ibov', rotulo: 'IBOV', cor: '#facc15' },
] as const

const pct = (v: number): string =>
  `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v).toFixed(2).replace('.', ',')}%`

interface Props {
  dados: AssetBenchmarkResponse | null
}

export const CarteiraVsIndices: React.FC<Props> = ({ dados }) => {
  const pontos = dados?.pontos ?? []
  const ultimo = pontos[pontos.length - 1]
  const visiveis = SERIES.filter(
    (s) =>
      s.chave === 'carteira' ||
      (s.chave === 'cdi' && dados?.cdi_disponivel) ||
      (s.chave === 'ibov' && dados?.ibov_disponivel),
  )
  const faltando = [
    !dados?.cdi_disponivel ? 'CDI' : null,
    !dados?.ibov_disponivel ? 'IBOV' : null,
  ].filter(Boolean)

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface">Carteira vs CDI e IBOV</h3>
      <p className="text-xs text-on-surface-variant mb-4">
        {pontos.length > 0
          ? `Rentabilidade desde ${formatDate(pontos[0].date)}, sem contar aportes`
          : 'Rentabilidade sem contar aportes'}
      </p>

      {pontos.length < 2 || !ultimo ? (
        <div className="py-10 text-center">
          <span className="material-symbols-outlined text-3xl text-on-surface-variant mb-2 block">compare_arrows</span>
          <p className="text-sm text-on-surface-variant">
            {dados === null ? 'Não foi possível carregar o comparativo' : 'Precisa de pelo menos dois dias de coleta'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 mb-4">
            {visiveis.map((s) => {
              const valor = ultimo[s.chave]
              return (
                <div key={s.chave} className="rounded-xl bg-surface-container-high/50 px-3 py-2">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: s.cor }} aria-hidden />
                    <span className="text-xs text-on-surface-variant">{s.rotulo}</span>
                  </div>
                  <p className="text-sm font-semibold text-on-surface tabular-nums mt-0.5">
                    {valor === null ? '—' : pct(valor)}
                  </p>
                </div>
              )
            })}
          </div>

          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={pontos} margin={{ top: 4, right: 4, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#35343a" vertical={false} />
                <ReferenceLine y={0} stroke="#7a7986" strokeWidth={1} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(d: string) => formatDate(d, 'dd/MM')}
                  tick={{ fontSize: 11, fill: '#a9a8b3' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                  tick={{ fontSize: 11, fill: '#a9a8b3' }}
                  axisLine={false}
                  tickLine={false}
                  width={38}
                />
                <Tooltip
                  formatter={(valor: any, nome: any) => [
                    pct(Number(valor)),
                    SERIES.find((s) => s.chave === nome)?.rotulo ?? nome,
                  ]}
                  labelFormatter={(d: any) => formatDate(String(d))}
                  contentStyle={{ background: '#1f1f25', border: 'none', borderRadius: 12, fontSize: 12 }}
                />
                {visiveis.map((s) => (
                  <Line
                    key={s.chave}
                    type="monotone"
                    dataKey={s.chave}
                    stroke={s.cor}
                    strokeWidth={s.chave === 'carteira' ? 2 : 1.5}
                    dot={false}
                    connectNulls
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>

          {faltando.length > 0 && (
            <p className="text-xs text-on-surface-variant mt-3">
              {faltando.join(' e ')} indisponível no momento.
            </p>
          )}
        </>
      )}
    </div>
  )
}
