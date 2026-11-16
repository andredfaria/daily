import React, { useState } from 'react'
import { formatBRL } from '../../utils/format'
import type { ResumoCategorias } from '../../utils/gastosCategorias'

const VISIVEIS = 5

interface Props {
  resumo: ResumoCategorias
  info: (key: string) => { nome: string; icone: string }
  cor: (key: string) => string
  /** "setembro" — nome do mês da comparação. */
  mesAnterior: string
  /** Dia do corte quando a comparação é parcial. */
  diaCorte: number
  /** null enquanto o mês anterior não carregou (ou falhou): some a comparação. */
  comparar: boolean
  filtro: string | null
  onFiltrar: (key: string | null) => void
  onGerenciar: () => void
}

/** Gastar mais é ruim: subida em vermelho, queda em verde. */
const Variacao: React.FC<{ variacao: number | null; anterior: number }> = ({ variacao, anterior }) => {
  if (variacao === null) {
    return <span className="text-[11px] font-semibold text-primary">novo</span>
  }
  if (variacao === 0) return <span className="text-[11px] text-on-surface-variant">igual</span>
  const subiu = variacao > 0
  return (
    <span
      className={`flex items-center text-[11px] font-semibold tabular-nums ${subiu ? 'text-error' : 'text-tertiary'}`}
      title={`Antes: ${formatBRL(anterior)}`}
    >
      <span className="material-symbols-outlined text-sm" aria-hidden="true">{subiu ? 'arrow_upward' : 'arrow_downward'}</span>
      {Math.abs(variacao)}%
      <span className="sr-only">{subiu ? ' a mais' : ' a menos'} que antes ({formatBRL(anterior)})</span>
    </span>
  )
}

const PorCategoriaGastos: React.FC<Props> = ({
  resumo, info, cor, mesAnterior, diaCorte, comparar, filtro, onFiltrar, onGerenciar,
}) => {
  const [todas, setTodas] = useState(false)
  const { categorias, total, totalAnterior, ateHoje } = resumo
  const maior = categorias[0]?.total ?? 0
  // A categoria filtrada fica sempre à vista, mesmo fora das 5 primeiras.
  const mostradas = todas
    ? categorias
    : categorias.filter((c, i) => i < VISIVEIS || c.key === filtro)
  const escondidas = categorias.length - mostradas.length
  const variacaoTotal = totalAnterior > 0 ? Math.round(((total - totalAnterior) / totalAnterior) * 100) : null

  return (
    <section className="glass-card rounded-2xl border border-outline-variant/50 p-5">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-on-surface">Por categoria</h2>
          <p className="text-xs text-on-surface-variant">
            {filtro ? 'Toque de novo para ver todas.' : 'Toque numa categoria para filtrar.'}
          </p>
        </div>
        <button
          onClick={onGerenciar}
          className="shrink-0 flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl text-xs font-semibold border border-dashed border-outline-variant text-on-surface-variant hover:text-primary hover:border-primary/50 transition-colors cursor-pointer"
        >
          <span className="material-symbols-outlined text-base">tune</span>
          Categorias
        </button>
      </div>

      {/* Composição do mês: cada fatia é a parte da categoria no total. */}
      <div className="flex h-3 w-full gap-0.5 overflow-hidden rounded-full mb-4" aria-hidden="true">
        {categorias.map((c) => (
          <span
            key={c.key}
            className="h-full transition-opacity"
            style={{
              width: `${Math.max(c.percentual, 1)}%`,
              backgroundColor: cor(c.key),
              opacity: filtro && filtro !== c.key ? 0.25 : 1,
            }}
          />
        ))}
      </div>

      <ul className="space-y-1" role="group" aria-label="Filtrar por categoria">
        {mostradas.map((c) => {
          const { nome, icone } = info(c.key)
          const ativo = filtro === c.key
          const apagado = filtro !== null && !ativo
          return (
            <li key={c.key}>
              <button
                onClick={() => onFiltrar(ativo ? null : c.key)}
                aria-pressed={ativo}
                className={`w-full flex items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors cursor-pointer ${
                  ativo ? 'bg-primary/15' : 'hover:bg-surface-container-high'
                } ${apagado ? 'opacity-50' : ''}`}
              >
                <span
                  className="w-9 h-9 shrink-0 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${cor(c.key)}26`, color: cor(c.key) }}
                >
                  <span className="material-symbols-outlined text-lg">{icone}</span>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="flex items-baseline justify-between gap-3">
                    <span className="text-sm text-on-surface truncate">{nome}</span>
                    <span className="text-sm font-semibold text-on-surface tabular-nums">{formatBRL(c.total)}</span>
                  </span>
                  <span className="mt-1 block h-1.5 rounded-full bg-surface-container overflow-hidden">
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${maior > 0 ? (c.total / maior) * 100 : 0}%`, backgroundColor: cor(c.key) }}
                    />
                  </span>
                  <span className="mt-1 flex items-center justify-between gap-3 text-[11px] text-on-surface-variant">
                    <span className="tabular-nums">
                      {c.percentual.toLocaleString('pt-BR')}% · {c.quantidade === 1 ? '1 gasto' : `${c.quantidade} gastos`}
                    </span>
                    {comparar && <Variacao variacao={c.variacao} anterior={c.anterior} />}
                  </span>
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      {(escondidas > 0 || todas) && categorias.length > VISIVEIS && (
        <button
          onClick={() => setTodas(!todas)}
          className="mt-2 flex items-center gap-1 min-h-[44px] px-2 text-xs font-semibold text-primary hover:text-primary/80 cursor-pointer"
        >
          {todas ? 'Mostrar menos' : `Ver mais ${escondidas} ${escondidas === 1 ? 'categoria' : 'categorias'}`}
          <span className="material-symbols-outlined text-base" aria-hidden="true">{todas ? 'expand_less' : 'expand_more'}</span>
        </button>
      )}

      {comparar && (
        <p className="mt-3 pt-3 border-t border-outline-variant/30 text-[11px] text-on-surface-variant">
          Comparado com {mesAnterior}{ateHoje ? ` até o dia ${diaCorte}` : ''}: {formatBRL(totalAnterior)}
          {variacaoTotal !== null && variacaoTotal !== 0 && (
            <span className={variacaoTotal > 0 ? 'text-error' : 'text-tertiary'}>
              {' '}({variacaoTotal > 0 ? '+' : ''}{variacaoTotal}% no total)
            </span>
          )}
        </p>
      )}
    </section>
  )
}

export default PorCategoriaGastos
