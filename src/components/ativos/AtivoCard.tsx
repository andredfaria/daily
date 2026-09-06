import React from 'react'
import type { AssetKind, AssetWithQuote } from '../../types'

const KIND_LABELS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

const KIND_ICONS: Record<AssetKind, string> = {
  stock: 'trending_up',
  fii: 'apartment',
  crypto: 'currency_bitcoin',
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const formatPct = (value: number) =>
  Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

const formatQuantity = (quantity: number) =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

const Badge: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <span
    className={`text-[10px] font-medium px-2 py-0.5 rounded-full flex items-center gap-1 ${
      className ?? 'bg-surface-variant text-on-surface-variant'
    }`}
  >
    {children}
  </span>
)

interface AtivoCardProps {
  ativo: AssetWithQuote
  onEdit: (ativo: AssetWithQuote) => void
  onDelete: (alvo: { id: string; ticker: string }) => void
  onReativar: (id: string, ticker: string) => void
}

/**
 * Card de ativo na anatomia do BillCard (src/pages/contas/ContasLista.tsx):
 * tile de ícone e identidade em cima, ações em ícone no canto, fileira de
 * badges no meio e o número herói no rodapé. Aqui o herói é a cotação, e o
 * lucro/prejuízo ocupa o slot que na conta é do lembrete.
 */
export const AtivoCard: React.FC<AtivoCardProps> = ({ ativo, onEdit, onDelete, onReativar }) => {
  const pausado = !!ativo.target_triggered_at || !!ativo.stop_triggered_at
  const lucro = ativo.profit_loss ?? 0
  const positivo = lucro >= 0
  const temPosicao = ativo.quantity > 0 && ativo.profit_loss !== null

  return (
    <div className="glass-card rounded-2xl border border-outline-variant/50 hover:border-primary/30 p-5 transition-all duration-200 h-full flex flex-col">
      {/* Identidade + ações */}
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
          <span className="material-symbols-outlined text-lg text-primary">{KIND_ICONS[ativo.kind]}</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-on-surface leading-tight truncate pt-2">
              {ativo.ticker}
            </h3>
            <div className="flex items-center gap-0.5 flex-shrink-0 -mt-1 -mr-1.5">
              <button
                onClick={() => onEdit(ativo)}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                title="Editar"
                aria-label={`Editar ${ativo.ticker}`}
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button
                onClick={() => onDelete({ id: ativo.id, ticker: ativo.ticker })}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-error cursor-pointer"
                title="Remover"
                aria-label={`Remover ${ativo.ticker}`}
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5 truncate" title={ativo.short_name}>
            {ativo.short_name}
          </p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <Badge>{KIND_LABELS[ativo.kind]}</Badge>

        {temPosicao && (
          <Badge>
            {formatQuantity(ativo.quantity)} un. · pago R$ {brl(ativo.avg_price)}
          </Badge>
        )}

        {ativo.target_price !== null && (
          <Badge>
            <span className="material-symbols-outlined text-xs">flag</span>
            alvo R$ {brl(ativo.target_price)}
          </Badge>
        )}

        {ativo.stop_price !== null && (
          <Badge>
            <span className="material-symbols-outlined text-xs">shield</span>
            stop R$ {brl(ativo.stop_price)}
          </Badge>
        )}

        {ativo.quote_stale && (
          // Ícone junto do texto: a cor sozinha não pode ser o aviso.
          <Badge className="bg-surface-container text-on-surface-variant border border-outline-variant/30">
            <span className="material-symbols-outlined text-xs">cloud_off</span>
            cotação indisponível
          </Badge>
        )}
      </div>

      {/* Continua bloco, não badge: carrega ação de recuperação e explicação. */}
      {pausado && (
        <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2 mt-3">
          <span className="text-xs text-on-surface">
            {ativo.target_triggered_at ? 'Alvo atingido' : 'Stop atingido'} — alertas pausados
          </span>
          <button
            onClick={() => onReativar(ativo.id, ativo.ticker)}
            className="text-xs font-medium text-primary px-3 min-h-[44px] cursor-pointer"
          >
            Reativar
          </button>
        </div>
      )}

      {/* Cotação + resultado. mt-auto alinha o rodapé de todos os cards da linha. */}
      <div className="flex items-end justify-between gap-2 mt-auto pt-4">
        <div className="min-w-0">
          <div className="text-xl font-bold text-primary tabular-nums">
            {ativo.current_price === null ? '—' : `R$ ${brl(ativo.current_price)}`}
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">cotação atual</p>
        </div>

        {temPosicao && (
          <p
            className={`text-xs font-semibold text-right tabular-nums ${
              positivo ? 'text-tertiary' : 'text-error'
            }`}
          >
            {positivo ? '+' : '−'}R$ {brl(Math.abs(lucro))}
            <span className="block font-medium">
              {positivo ? '+' : '−'}
              {formatPct(ativo.profit_loss_pct ?? 0)}%
            </span>
          </p>
        )}
      </div>
    </div>
  )
}
