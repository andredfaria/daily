import React, { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts'
import type { AssetKind } from '../../../types'
import type { FatiaAlocacao } from '../../../utils/assetAnalytics'
import { rotuloTipo } from '../../../utils/assetAnalytics'
import { formatBRL } from '../../../utils/format'

// Cores dos tokens do design system: primary (lavanda), tertiary suavizado
// (menta) e o amarelo de destaque já usado nos StatCards de vencimento.
// Recharts precisa de hex literal, por isso o mapa fica aqui em vez de classe.
const CORES: Record<AssetKind, string> = {
  stock: '#c0c1ff',
  fii: '#7fd8a0',
  crypto: '#facc15',
}

// Fundo da página (surface). Serve de traço entre as fatias, para que duas
// cores vizinhas não encostem uma na outra.
const SEPARADOR = '#131318'

const pct = (v: number): string => `${v.toFixed(1).replace('.', ',')}%`

// A entrada do gráfico é decorativa; quem lê a alocação lê a lista abaixo.
const semMovimento = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export const AlocacaoPorTipo: React.FC<{ fatias: FatiaAlocacao[] }> = ({ fatias }) => {
  // Dois estados de propósito: o clique fixa a fatia (único caminho no toque,
  // onde não há hover) e o hover só pré-visualiza, sem apagar o que foi fixado.
  const [fixado, setFixado] = useState<AssetKind | null>(null)
  const [sobre, setSobre] = useState<AssetKind | null>(null)
  const selecionado = fixado ?? sobre

  if (fatias.length === 0) {
    return (
      <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
        <h3 className="text-base font-semibold text-on-surface mb-2">Alocação por tipo</h3>
        <p className="text-sm text-on-surface-variant">Nenhuma posição com cotação para alocar.</p>
      </div>
    )
  }

  const total = fatias.reduce((s, f) => s + f.valor, 0)
  const emFoco = fatias.find((f) => f.kind === selecionado) ?? null

  // O gráfico é imagem: o resumo textual é o que o leitor de tela recebe.
  const resumo = fatias.map((f) => `${rotuloTipo(f.kind)} ${pct(f.pct)}`).join(', ')

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 p-6">
      <h3 className="text-base font-semibold text-on-surface mb-4">Alocação por tipo</h3>

      <div className="relative w-full max-w-[200px] mx-auto aspect-square mb-5">
        <div role="img" aria-label={`Alocação por tipo: ${resumo}.`} className="w-full h-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={fatias}
                dataKey="valor"
                nameKey="kind"
                innerRadius="66%"
                outerRadius="100%"
                paddingAngle={fatias.length > 1 ? 2 : 0}
                stroke={SEPARADOR}
                strokeWidth={2}
                isAnimationActive={!semMovimento()}
                onClick={(_, i) => setFixado((atual) => (atual === fatias[i].kind ? null : fatias[i].kind))}
                className="cursor-pointer focus:outline-none"
              >
                {fatias.map((f) => (
                  <Cell
                    key={f.kind}
                    fill={CORES[f.kind]}
                    fillOpacity={selecionado === null || selecionado === f.kind ? 1 : 0.25}
                  />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>

        {/* Leitura central: o miolo do donut carrega o total, ou a fatia em
            foco. Substitui o tooltip, que só existia no hover do desktop. */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none px-6 text-center">
          <span className="text-[11px] uppercase tracking-wide text-on-surface-variant">
            {emFoco ? rotuloTipo(emFoco.kind) : 'Total'}
          </span>
          <span className="text-base font-bold text-on-surface tabular-nums leading-tight">
            {formatBRL(emFoco ? emFoco.valor : total)}
          </span>
          {emFoco && (
            <span className="text-sm font-semibold tabular-nums" style={{ color: CORES[emFoco.kind] }}>
              {pct(emFoco.pct)}
            </span>
          )}
        </div>
      </div>

      <ul className="space-y-1">
        {fatias.map((f) => {
          const ativo = selecionado === f.kind
          return (
            <li key={f.kind}>
              <button
                type="button"
                aria-pressed={fixado === f.kind}
                onClick={() => setFixado(fixado === f.kind ? null : f.kind)}
                onPointerEnter={(e) => { if (e.pointerType === 'mouse') setSobre(f.kind) }}
                onPointerLeave={(e) => { if (e.pointerType === 'mouse') setSobre(null) }}
                onFocus={() => setSobre(f.kind)}
                onBlur={() => setSobre(null)}
                className={`w-full min-h-[44px] px-2 py-2 rounded-xl text-left transition-colors duration-200 cursor-pointer
                  focus:outline-none focus-visible:ring-1 focus-visible:ring-primary
                  ${ativo ? 'bg-surface-container-high' : 'hover:bg-surface-container-high/50'}`}
              >
                <div className="flex items-baseline gap-2">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0 self-center"
                    style={{ background: CORES[f.kind] }}
                  />
                  <span className="text-sm text-on-surface flex-1 truncate">{rotuloTipo(f.kind)}</span>
                  <span className="text-sm font-semibold text-on-surface tabular-nums">{pct(f.pct)}</span>
                </div>
                <div className="flex items-center gap-2 mt-1.5 pl-[18px]">
                  {/* A barra repete a proporção sem depender da cor da fatia. */}
                  <span className="relative flex-1 h-1.5 bg-surface-container rounded-full overflow-hidden">
                    <span
                      className="absolute inset-y-0 left-0 rounded-full transition-all duration-200"
                      style={{ width: `${f.pct}%`, background: CORES[f.kind] }}
                    />
                  </span>
                  <span className="text-sm text-on-surface-variant tabular-nums flex-shrink-0">
                    {formatBRL(f.valor)}
                  </span>
                </div>
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
