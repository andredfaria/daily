import React, { useEffect, useState } from 'react'
import { assetsApi, CreateAssetPayload } from '../../api/assets'
import type { AssetKind, AssetWithQuote } from '../../types'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/ui/Modal'

const KIND_LABELS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Espelha formatPct de backend/src/services/assetMath.ts — mesma casa decimal
// no WhatsApp e na tela, para não mostrar "+20,9%" lá e "+20.9%" aqui.
const formatPct = (value: number) =>
  Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

// Espelha formatQuantity de backend/src/services/assetMath.ts — quantidade
// fracionária (cripto) sai com vírgula, não ponto: "0,005", não "0.005".
const formatQuantity = (quantity: number) =>
  Number.isInteger(quantity)
    ? String(quantity)
    : quantity.toLocaleString('pt-BR', { maximumFractionDigits: 8 })

const FORM_INICIAL: CreateAssetPayload = {
  ticker: '', kind: 'stock', quantity: 0, avg_price: 0, target_price: null, stop_price: null,
}

const AtivosCarteira: React.FC = () => {
  const { showToast } = useToast()
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<CreateAssetPayload>(FORM_INICIAL)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; ticker: string } | null>(null)
  const [excluindo, setExcluindo] = useState(false)

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

  const fecharForm = () => {
    setForm(FORM_INICIAL)
    setEditingId(null)
    setFormAberto(false)
  }

  const iniciarEdicao = (a: AssetWithQuote) => {
    setEditingId(a.id)
    setForm({
      ticker: a.ticker,
      kind: a.kind,
      quantity: a.quantity,
      avg_price: a.avg_price,
      target_price: a.target_price,
      stop_price: a.stop_price,
    })
    setFormAberto(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    try {
      if (editingId) {
        await assetsApi.update(editingId, {
          quantity: form.quantity,
          avg_price: form.avg_price,
          target_price: form.target_price || null,
          stop_price: form.stop_price || null,
        })
        showToast(`${form.ticker.toUpperCase()} atualizado`, 'success')
      } else {
        await assetsApi.create({
          ...form,
          target_price: form.target_price || null,
          stop_price: form.stop_price || null,
        })
        showToast(`${form.ticker.toUpperCase()} adicionado à carteira`, 'success')
      }
      fecharForm()
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

  const confirmarRemocao = async () => {
    if (!deleteTarget) return
    setExcluindo(true)
    try {
      await assetsApi.delete(deleteTarget.id)
      showToast(`${deleteTarget.ticker} removido`, 'success')
      setDeleteTarget(null)
      carregar()
    } catch {
      showToast('Não consegui remover o ativo', 'error')
    } finally {
      setExcluindo(false)
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
          onClick={() => (formAberto ? fecharForm() : setFormAberto(true))}
          className="flex items-center gap-1.5 px-4 min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-medium"
        >
          <span className="material-symbols-outlined text-[20px]">{formAberto ? 'close' : 'add'}</span>
          {formAberto ? 'Cancelar' : 'Novo ativo'}
        </button>
      </div>

      {formAberto && (
        <form onSubmit={salvar} className="rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-4 space-y-3">
          {editingId && (
            <p className="text-xs text-on-surface-variant">
              Editando {form.ticker} — ticker e tipo não podem ser alterados.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Ticker
              <input
                required
                disabled={!!editingId}
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder="PETR4"
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface disabled:opacity-50"
              />
            </label>
            <label className="flex flex-col gap-1 text-xs text-on-surface-variant">
              Tipo
              <select
                disabled={!!editingId}
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as AssetKind })}
                className="min-h-[48px] px-3 rounded-xl bg-surface-container border border-outline-variant/50 text-sm text-on-surface disabled:opacity-50"
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
            {salvando ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar à carteira'}
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
                    {formatQuantity(a.quantity)} un. · pago R$ {brl(a.avg_price)}
                  </span>
                  <span className={`font-semibold ${positivo ? 'text-tertiary' : 'text-error'}`}>
                    {positivo ? '+' : '-'}R$ {brl(Math.abs(lucro))} ({positivo ? '+' : '-'}
                    {formatPct(a.profit_loss_pct ?? 0)}%)
                  </span>
                </div>
              )}

              <div className="flex flex-wrap gap-2 text-[11px] text-on-surface-variant">
                {a.target_price !== null && (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">flag</span>
                    alvo R$ {brl(a.target_price)}
                  </span>
                )}
                {a.stop_price !== null && (
                  <span className="inline-flex items-center gap-1">
                    <span className="material-symbols-outlined text-[14px]">shield</span>
                    stop R$ {brl(a.stop_price)}
                  </span>
                )}
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

              <div className="flex justify-end gap-2">
                <button
                  onClick={() => iniciarEdicao(a)}
                  className="flex items-center gap-1 text-xs text-on-surface-variant px-3 min-h-[48px]"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Editar
                </button>
                <button
                  onClick={() => setDeleteTarget({ id: a.id, ticker: a.ticker })}
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

      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmarRemocao}
        title="Remover ativo"
        description={`Remover ${deleteTarget?.ticker} da carteira? Essa ação não pode ser desfeita.`}
        confirmLabel="Remover"
        cancelLabel="Cancelar"
        variant="danger"
        loading={excluindo}
      />
    </div>
  )
}

export default AtivosCarteira
