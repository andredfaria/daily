import React, { useState } from 'react'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine, ResponsiveContainer, Cell,
} from 'recharts'
import type { DiaGasto, ResumoDiario } from '../../utils/gastosDiarios'
import { formatBRL, formatDate } from '../../utils/format'

// Mesmas cores dos outros gráficos (SpendingTrendChart): o app é só tema escuro.
const COR_SERIE = '#c0c1ff'
const COR_GRADE = '#464554'
const COR_EIXO = '#c7c4d7'
const COR_REFERENCIA = '#908fa0'

type Visao = 'barras' | 'linha' | 'acumulado' | 'categorias'
type VisaoDica = 'dia' | 'acumulado'

interface Props {
  resumo: ResumoDiario
  /** Nome da categoria quando a lista está filtrada — o gráfico segue o filtro. */
  categoria: string | null
  diaSelecionado: string | null
  onSelecionarDia: (dia: string | null) => void
  categoriasData: Array<{ nome: string; total: number; key: string }>
  serieCategorias: Array<Record<string, string | number>>
}

const CORES_CATEGORIA = ['#c0c1ff', '#ffb4ab', '#a8dab5', '#f2c078', '#80d5df', '#e8b7d4', '#d0bcff', '#f5a97f']

const rotuloDia = (dia: string) => formatDate(dia, 'EEE, dd/MM')

const Dica: React.FC<{ active?: boolean; payload?: Array<{ payload: DiaGasto }>; visao: VisaoDica }> = ({ active, payload, visao }) => {
  const p = active ? payload?.[0]?.payload : undefined
  if (!p) return null
  return (
    <div className="rounded-xl border border-outline-variant bg-[#1f1f25] px-3 py-2 text-xs shadow-lg">
      <p className="text-on-surface-variant capitalize mb-0.5">{rotuloDia(p.dia)}</p>
      {visao === 'dia' ? (
        <>
          <p className="text-sm font-semibold text-on-surface">{formatBRL(p.total)}</p>
          <p className="text-on-surface-variant">
            {p.quantidade === 0 ? 'Sem gasto' : p.quantidade === 1 ? '1 gasto' : `${p.quantidade} gastos`}
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-semibold text-on-surface">{formatBRL(p.acumulado)}</p>
          <p className="text-on-surface-variant">acumulado no mês</p>
        </>
      )}
    </div>
  )
}

const TooltipCategorias: React.FC<{
  active?: boolean
  payload?: Array<{ payload: Record<string, string | number> }>
  categoriasData: Array<{ nome: string; total: number; key: string }>
}> = ({ active, payload, categoriasData }) => {
  const ponto = active ? payload?.[0]?.payload : undefined
  if (!ponto || typeof ponto.dia !== 'string') return null
  const valores = categoriasData
    .map((categoria) => ({ ...categoria, valor: Number(ponto[categoria.key] ?? 0) }))
    .filter((categoria) => categoria.valor > 0)
  const total = valores.reduce((soma, categoria) => soma + categoria.valor, 0)
  return (
    <div className="rounded-xl border border-outline-variant bg-[#1f1f25] px-3 py-2 text-xs shadow-lg">
      <p className="text-on-surface-variant capitalize mb-1">{rotuloDia(ponto.dia)}</p>
      {valores.map((categoria) => (
        <p key={categoria.key} className="flex justify-between gap-4 text-on-surface-variant">
          <span>{categoria.nome}</span><span className="text-on-surface">{formatBRL(categoria.valor)}</span>
        </p>
      ))}
      <p className="mt-1 border-t border-outline-variant pt-1 font-semibold text-on-surface">Total {formatBRL(total)}</p>
    </div>
  )
}

const Destaque: React.FC<{ rotulo: React.ReactNode; valor: string; detalhe?: string }> = ({ rotulo, valor, detalhe }) => (
  <div className="min-w-0">
    <p className="flex items-center gap-1.5 text-[11px] text-on-surface-variant uppercase tracking-wide">{rotulo}</p>
    <p className="text-base font-semibold text-on-surface truncate">{valor}</p>
    {detalhe && <p className="text-[11px] text-on-surface-variant capitalize truncate">{detalhe}</p>}
  </div>
)

const DiaADiaGastos: React.FC<Props> = ({ resumo, categoria, diaSelecionado, onSelecionarDia, categoriasData, serieCategorias }) => {
  const [visao, setVisao] = useState<Visao>('barras')
  const { serie, mediaPorDia, maiorDia, diasComGasto } = resumo

  // A coluna inteira é a área de toque, não só a barra: dia de R$ 5 vira um
  // retângulo de 2px. Dia sem gasto não seleciona — a lista ficaria vazia.
  const tocar = (estado: { activeIndex?: number | string | null } | null) => {
    const i = Number(estado?.activeIndex)
    const p = Number.isInteger(i) ? serie[i] : undefined
    if (!p || p.quantidade === 0) return
    onSelecionarDia(p.dia === diaSelecionado ? null : p.dia)
  }

  const descricao = maiorDia
    ? `Gastos por dia: média de ${formatBRL(mediaPorDia)}, maior dia ${rotuloDia(maiorDia.dia)} com ${formatBRL(maiorDia.total)}.`
    : 'Sem gastos no período.'

  // De 5 em 5 dias, mais o último: o automático do recharts pulava dias de
  // forma irregular (11, 13, 17…).
  const ultimo = serie.length
  const marcas = [1, 5, 10, 15, 20, 25, 30].filter((d) => d < ultimo - 1).concat(ultimo)
  const eixoX = (
    <XAxis
      dataKey="numero"
      ticks={marcas}
      interval={0}
      tick={{ fontSize: 11, fill: COR_EIXO }}
      axisLine={{ stroke: COR_GRADE }}
      tickLine={false}
    />
  )
  const eixoY = (
    <YAxis
      tick={{ fontSize: 11, fill: COR_EIXO }}
      width={48}
      axisLine={false}
      tickLine={false}
      tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 100) / 10}k` : String(v))}
    />
  )

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Dia a dia</h2>
          <p className="text-xs text-on-surface-variant">
            {categoria ? `Só ${categoria}. ` : ''}Toque num dia para ver os gastos dele.
          </p>
        </div>
        <div className="flex rounded-xl bg-surface-container p-1" role="group" aria-label="Visão do gráfico">
          {([['barras', 'Barras'], ['linha', 'Linha'], ['categorias', 'Por categoria'], ['acumulado', 'Acumulado']] as const).map(([v, rotulo]) => (
            <button
              key={v}
              onClick={() => setVisao(v)}
              aria-pressed={visao === v}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                visao === v ? 'bg-primary text-on-primary-fixed' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {rotulo}
            </button>
          ))}
        </div>
      </div>

      {visao !== 'categorias' && <div className="grid grid-cols-3 gap-3 mb-4">
        <Destaque
          rotulo={visao === 'barras' || visao === 'linha'
            ? <><span className="w-3 border-t border-dashed border-outline" aria-hidden="true" />Média/dia</>
            : 'Média/dia'}
          valor={formatBRL(mediaPorDia)}
        />
        <Destaque
          rotulo="Maior dia"
          valor={maiorDia ? formatBRL(maiorDia.total) : '—'}
          detalhe={maiorDia ? rotuloDia(maiorDia.dia) : undefined}
        />
        <Destaque rotulo="Com gasto" valor={`${diasComGasto} de ${serie.length}`} detalhe="dias" />
      </div>}

      <div className="w-full h-56" role="img" aria-label={descricao}>
        <ResponsiveContainer width="100%" height="100%">
          {visao === 'categorias' ? (
            <BarChart data={serieCategorias} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} onClick={tocar}>
              <CartesianGrid vertical={false} stroke={COR_GRADE} strokeOpacity={0.3} />
              {eixoX}
              {eixoY}
              <Tooltip content={<TooltipCategorias categoriasData={categoriasData} />} cursor={{ fill: COR_SERIE, fillOpacity: 0.08 }} />
              {categoriasData.map((item, i) => (
                <Bar key={item.key} dataKey={item.key} name={item.nome} stackId="gastos" fill={CORES_CATEGORIA[i % CORES_CATEGORIA.length]} maxBarSize={18} isAnimationActive={false} />
              ))}
            </BarChart>
          ) : visao === 'linha' ? (
            <LineChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} onClick={tocar}>
              <CartesianGrid vertical={false} stroke={COR_GRADE} strokeOpacity={0.3} />
              {eixoX}
              {eixoY}
              <Tooltip content={<Dica visao="dia" />} cursor={{ stroke: COR_REFERENCIA, strokeDasharray: '3 3' }} />
              {mediaPorDia > 0 && <ReferenceLine y={mediaPorDia} stroke={COR_REFERENCIA} strokeDasharray="3 3" />}
              <Line type="monotone" dataKey="total" stroke={COR_SERIE} strokeWidth={2.5} dot={false} activeDot={{ r: 5 }} isAnimationActive={false} />
            </LineChart>
          ) : visao === 'barras' ? (
            <BarChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} onClick={tocar}>
              <CartesianGrid vertical={false} stroke={COR_GRADE} strokeOpacity={0.3} />
              {eixoX}
              {eixoY}
              <Tooltip content={<Dica visao="dia" />} cursor={{ fill: COR_SERIE, fillOpacity: 0.08 }} />
              {mediaPorDia > 0 && <ReferenceLine y={mediaPorDia} stroke={COR_REFERENCIA} strokeDasharray="3 3" />}
              <Bar dataKey="total" radius={[4, 4, 0, 0]} maxBarSize={18} isAnimationActive={false} className="cursor-pointer">
                {serie.map((p) => <Cell key={p.dia} fill={COR_SERIE} fillOpacity={diaSelecionado && p.dia !== diaSelecionado ? 0.3 : 1} />)}
              </Bar>
            </BarChart>
          ) : (
            <AreaChart data={serie} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} onClick={tocar}>
              <defs>
                <linearGradient id="acumuladoFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={COR_SERIE} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={COR_SERIE} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke={COR_GRADE} strokeOpacity={0.3} />
              {eixoX}
              {eixoY}
              <Tooltip content={<Dica visao="acumulado" />} cursor={{ stroke: COR_REFERENCIA, strokeDasharray: '3 3' }} />
              {diaSelecionado && (
                <ReferenceLine x={Number(diaSelecionado.slice(8, 10))} stroke={COR_SERIE} strokeOpacity={0.6} />
              )}
              <Area
                type="monotone"
                dataKey="acumulado"
                stroke={COR_SERIE}
                strokeWidth={2}
                fill="url(#acumuladoFill)"
                activeDot={{ r: 4, stroke: '#1f1f25', strokeWidth: 2 }}
                isAnimationActive={false}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
      {visao === 'categorias' && (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2" aria-label="Legenda de categorias">
          {categoriasData.map((item, i) => (
            <span key={item.key} className="flex items-center gap-1.5 text-[11px] text-on-surface-variant">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: CORES_CATEGORIA[i % CORES_CATEGORIA.length] }} />
              {item.nome}
            </span>
          ))}
        </div>
      )}
    </section>
  )
}

export default DiaADiaGastos
