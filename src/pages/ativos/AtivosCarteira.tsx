import React, { useEffect, useState } from 'react'
import { assetsApi } from '../../api/assets'
import type { AssetKind, AssetWithQuote } from '../../types'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/ui/Modal'
import NumberField from '../../components/ui/NumberField'
import { formatNumericInput, parseNumericInput } from '../../utils/numberInput'

const KIND_LABELS: Record<AssetKind, string> = {
  stock: 'Ação',
  fii: 'FII',
  crypto: 'Cripto',
}

// O formato do código muda por tipo — o campo precisa dizer isso antes de o
// usuário errar: ação/FII usam o ticker da B3, cripto usa o símbolo da moeda.
const KIND_PLACEHOLDER: Record<AssetKind, string> = {
  stock: 'PETR4',
  fii: 'MXRF11',
  crypto: 'BTC',
}

const KIND_HINT: Record<AssetKind, string> = {
  stock: 'Ticker da B3, como PETR4 ou VALE3',
  fii: 'Ticker do fundo, como MXRF11 ou HGLG11',
  crypto: 'Símbolo da moeda, como BTC, ETH ou SOL — cotação em BRL',
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

// Campos numéricos ficam como string para o usuário poder deixá-los vazios
// enquanto digita. A conversão para número acontece só no envio.
interface FormAtivo {
  ticker: string
  kind: AssetKind
  quantity: string
  avg_price: string
  target_price: string
  stop_price: string
}

interface ErrosAtivo {
  ticker?: string
  quantity?: string
  avg_price?: string
}

const FORM_INICIAL: FormAtivo = {
  ticker: '', kind: 'stock', quantity: '', avg_price: '', target_price: '', stop_price: '',
}

const AtivosCarteira: React.FC = () => {
  const { showToast } = useToast()
  const [ativos, setAtivos] = useState<AssetWithQuote[]>([])
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [formAberto, setFormAberto] = useState(false)
  const [form, setForm] = useState<FormAtivo>(FORM_INICIAL)
  const [erros, setErros] = useState<ErrosAtivo>({})
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
    setErros({})
    setEditingId(null)
    setFormAberto(false)
  }

  // Preço opcional vazio significa "sem alerta" — vira null, não zero.
  const precoOpcional = (texto: string) => (texto === '' ? null : parseNumericInput(texto))

  // Trocar o tipo muda o formato esperado do código (PETR4 x BTC): o erro
  // anterior deixa de valer e o campo ganha o novo exemplo.
  const trocarTipo = (kind: AssetKind) => {
    setForm((f) => ({ ...f, kind }))
    setErros((e) => ({ ...e, ticker: undefined }))
  }

  const iniciarEdicao = (a: AssetWithQuote) => {
    setEditingId(a.id)
    setErros({})
    setForm({
      ticker: a.ticker,
      kind: a.kind,
      quantity: formatNumericInput(a.quantity, 8),
      avg_price: formatNumericInput(a.avg_price, 2, { padDecimals: true }),
      target_price: a.target_price != null ? formatNumericInput(a.target_price, 2, { padDecimals: true }) : '',
      stop_price: a.stop_price != null ? formatNumericInput(a.stop_price, 2, { padDecimals: true }) : '',
    })
    setFormAberto(true)
  }

  const salvar = async (e: React.FormEvent) => {
    e.preventDefault()

    const quantidade = parseNumericInput(form.quantity)
    const precoMedio = parseNumericInput(form.avg_price)
    const novosErros: ErrosAtivo = {}
    if (!form.ticker.trim()) novosErros.ticker = 'Informe o ticker'
    if (quantidade === null || quantidade <= 0) novosErros.quantity = 'Informe uma quantidade maior que zero'
    if (precoMedio === null || precoMedio <= 0) novosErros.avg_price = 'Informe o preço médio pago'
    setErros(novosErros)
    if (Object.keys(novosErros).length > 0) return

    setSalvando(true)
    try {
      if (editingId) {
        await assetsApi.update(editingId, {
          ticker: form.ticker.trim().toUpperCase(),
          kind: form.kind,
          quantity: quantidade!,
          avg_price: precoMedio!,
          target_price: precoOpcional(form.target_price),
          stop_price: precoOpcional(form.stop_price),
        })
        showToast(`${form.ticker.toUpperCase()} atualizado`, 'success')
      } else {
        await assetsApi.create({
          ticker: form.ticker.trim().toUpperCase(),
          kind: form.kind,
          quantity: quantidade!,
          avg_price: precoMedio!,
          target_price: precoOpcional(form.target_price),
          stop_price: precoOpcional(form.stop_price),
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
              Editando {ativos.find((a) => a.id === editingId)?.ticker ?? form.ticker}. Trocar o
              ticker ou o tipo reinicia a cotação e os alertas, mas mantém o histórico do ativo.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label htmlFor="ativo-ticker" className="label">Ticker <span className="text-error">*</span></label>
              <input
                id="ativo-ticker"
                aria-required="true"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                value={form.ticker}
                onChange={(e) => setForm({ ...form, ticker: e.target.value.toUpperCase() })}
                placeholder={KIND_PLACEHOLDER[form.kind]}
                aria-invalid={!!erros.ticker}
                aria-describedby={erros.ticker ? 'ativo-ticker-erro' : 'ativo-ticker-hint'}
                className={`input-field min-h-[48px] uppercase ${erros.ticker ? 'error' : ''}`}
              />
              {erros.ticker ? (
                <p id="ativo-ticker-erro" role="alert" className="mt-1 flex items-center gap-1 text-xs text-error">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {erros.ticker}
                </p>
              ) : (
                <p id="ativo-ticker-hint" className="mt-1 text-xs text-on-surface-variant">
                  {KIND_HINT[form.kind]}
                </p>
              )}
            </div>
            <div>
              <label htmlFor="ativo-tipo" className="label">Tipo</label>
              <select
                id="ativo-tipo"
                value={form.kind}
                onChange={(e) => trocarTipo(e.target.value as AssetKind)}
                className="input-field min-h-[48px]"
              >
                <option value="stock">Ação</option>
                <option value="fii">FII</option>
                <option value="crypto">Cripto</option>
              </select>
            </div>

            {form.kind === 'crypto' && (
              <div
                role="status"
                className="sm:col-span-2 flex items-start gap-2 rounded-xl border border-yellow-400/40 bg-yellow-400/10 p-3"
              >
                <span className="material-symbols-outlined text-yellow-400 text-lg shrink-0">info</span>
                <p className="text-xs text-on-surface-variant">
                  A brapi.dev liberou criptomoedas só nos planos pagos. Com um token do plano
                  gratuito o cadastro vai falhar na busca da cotação — ações e FIIs seguem
                  funcionando normalmente.
                </p>
              </div>
            )}
            <NumberField
              label="Quantidade"
              required
              mode="decimal"
              min={0}
              placeholder="0"
              hint="Aceita fração — ex.: 0,005"
              value={form.quantity}
              onChange={(v) => setForm({ ...form, quantity: v })}
              error={erros.quantity}
            />
            <NumberField
              label="Preço médio pago"
              required
              mode="currency"
              min={0}
              prefix="R$"
              placeholder="0,00"
              value={form.avg_price}
              onChange={(v) => setForm({ ...form, avg_price: v })}
              error={erros.avg_price}
            />
            <NumberField
              label="Preço-alvo de venda"
              mode="currency"
              min={0}
              prefix="R$"
              placeholder="Opcional"
              hint="Avisa no WhatsApp quando a cotação chegar aqui"
              value={form.target_price}
              onChange={(v) => setForm({ ...form, target_price: v })}
            />
            <NumberField
              label="Stop"
              mode="currency"
              min={0}
              prefix="R$"
              placeholder="Opcional"
              hint="Avisa se a cotação cair até este preço"
              value={form.stop_price}
              onChange={(v) => setForm({ ...form, stop_price: v })}
            />
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
