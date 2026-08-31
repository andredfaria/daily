import React, { useEffect, useState } from 'react'
import { assetsApi, CreateAssetPayload } from '../api/assets'
import type { AssetKind, AssetWithQuote } from '../types'
import { useToast } from '../context/ToastContext'

const KIND_LABELS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const FORM_INICIAL: CreateAssetPayload = {
  ticker: '', kind: 'stock', quantity: 0, avg_price: 0, target_price: null, stop_price: null,
}

const Ativos: React.FC = () => {
  const { showToast } = useToast()
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CreateAssetPayload>(FORM_INICIAL)

  const carregar = async () => {
    setCarregando(true)
    try {
      setAtivos(await assetsApi.list())
    } catch {
      showToast('Não consegui carregar seus ativos', 'error')
    } finally {
      setCarregando(false)
    }
  }

  useEffect(() => { carregar() }, [])

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      await assetsApi.create({
        ...form,
        target_price: form.target_price || null,
        stop_price: form.stop_price || null,
      })
      showToast(`${form.ticker.toUpperCase()} adicionado à carteira`, 'success')
      setForm(FORM_INICIAL)
      setFormAberto(false)
      carregar()
    } catch (err: any) {
      showToast(err.response?.data?.error ?? 'Não consegui salvar o ativo', 'error')
    } finally {
      setSalvando(false)
    }
  }

  const reativar = async (id: string, ticker: string) => {
    try {
      await assetsApi.rearm(id)
      showToast(`Alertas de ${ticker} reativados`, 'success')
      carregar()
    } catch {
      showToast('Não consegui reativar os alertas', 'error')
    }
  }

  const remover = async (id: string, ticker: string) => {
    if (!confirm(`Remover ${ticker} da carteira?`)) return
    try {
      await assetsApi.delete(id)
      showToast(`${ticker} removido`, 'success')
      carregar()
    } catch {
      showToast('Não consegui remover o ativo', 'error')
    }
  }

  if (carregando) {
    return (
      <div className="flex items-center justify-center py-20">
        <span className="material-symbols-outlined text-primary text-4xl animate-spin">progress_activity</span>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-on-surface-variant">
          {ativos.length === 0
            ? 'Nenhum ativo na carteira'
            : `${ativos.length} ativo${ativos.length > 1 ? 's' : ''} monitorado${ativos.length > 1 ? 's' : ''}`}
        </p>
        <button
          onClick={() => setFormAberto((v) => !v)}
          className="flex items-center gap-1.5 px-4 min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[20px]">{formAberto ? 'close' : 'add'}</span>
          {formAberto ? 'Cancelar' : 'Novo ativo'}
        </button>
      </div>

      {formAberto && (
        <form onSubmit={salvar} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-4 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Ticker
              <input
                required
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder="PETR4"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Tipo
              <select
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              >
                <option value="stock">Ação</option>
                <option value="fii">FII</option>
                <option value="crypto">Cripto</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Quantidade
              <input
                type="number" step="any" min="0"
                value={form.quantity ?? 0}
                onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Preço médio pago (R$)
              <input
                type="number" step="any" min="0"
                value={form.avg_price ?? 0}
                onChange={(e) => setForm({ ...form, avg_price: Number(e.target.value) })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Preço-alvo de venda (R$)
              <input
                type="number" step="any" min="0"
                value={form.target_price ?? ''}
                onChange={(e) => setForm({ ...form, target_price: e.target.value ? Number(e.target.value) : null })}
                placeholder="opcional"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Stop (R$)
              <input
                type="number" step="any" min="0"
                value={form.stop_price ?? ''}
                onChange={(e) => setForm({ ...form, stop_price: e.target.value ? Number(e.target.value) : null })}
                placeholder="opcional"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface"
              />
            </label>
          </div>
          <button
            type="submit"
            disabled={salvando}
            className="w-full min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-medium disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Adicionar à carteira'}
          </button>
        </form>
      )}

      {ativos.length === 0 && !formAberto && (
        <div className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-8 text-center space-y-2">
          <span className="material-symbols-outlined text-on-surface-variant text-4xl">trending_up</span>
          <p className="text-sm font-medium text-on-surface">Sua carteira está vazia</p>
          <p className="text-xs text-on-surface-variant">
            Cadastre um ativo com preço-alvo e receba um aviso no WhatsApp quando a cotação chegar lá.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {ativos.map((a) => {
          const pausado = !!a.target_triggered_at || !!a.stop_triggered_at
          const lucro = a.profit_loss ?? 0
          const positivo = lucro >= 0
          return (
            <div key={a.id} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-bold text-on-surface">{a.ticker}</h3>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-surface-container text-on-surface-variant">
                      {KIND_LABELS[a.kind]}
                    </span>
                  </div>
                  <p className="text-xs text-on-surface-variant truncate">{a.short_name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold text-on-surface">
                    {a.current_price === null ? '—' : `R$ ${brl(a.current_price)}`}
                  </p>
                  {a.quote_stale && (
                    <p className="text-[10px] text-on-surface-variant">cotação indisponível</p>
                  )}
                </div>
              </div>

              {a.quantity > 0 && a.profit_loss !== null && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-on-surface-variant">
                    {a.quantity} un. · pago R$ {brl(a.avg_price)}
                  </span>
                  <span className={`font-semibold ${positivo ? 'text-tertiary' : 'text-error'}`}>
                    {positivo ? '+' : '-'}R$ {brl(Math.abs(lucro))} ({positivo ? '+' : '-'}
                    {Math.abs(a.profit_loss_pct ?? 0).toFixed(1)}%)
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
                {a.target_price !== null && <span>🎯 alvo R$ {brl(a.target_price)}</span>}
                {a.stop_price !== null && <span>🛑 stop R$ {brl(a.stop_price)}</span>}
              </div>

              {pausado && (
                <div className="flex items-center justify-between gap-2 rounded-xl bg-primary/10 px-3 py-2">
                  <span className="text-xs text-on-surface">
                    {a.target_triggered_at ? 'Alvo atingido' : 'Stop atingido'} — alertas pausados
                  </span>
                  <button
                    onClick={() => reativar(a.id, a.ticker)}
                    className="text-xs font-medium text-primary px-3 min-h-[48px]"
                  >
                    Reativar
                  </button>
                </div>
              )}

              <div className="flex justify-end">
                <button
                  onClick={() => remover(a.id, a.ticker)}
                  className="flex items-center gap-1 text-xs text-error px-3 min-h-[48px]"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                  Remover
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default Ativos
