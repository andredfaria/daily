import React, { useEffect, useRef, useState } from 'react'
import { assetsApi } from '../../api/assets'
import type { AssetKind, AssetWithQuote } from '../../types'
import { useToast } from '../../context/ToastContext'
import Modal from '../../components/ui/Modal'
import NumberField from '../../components/ui/NumberField'
import { formatNumericInput, parseNumericInput } from '../../utils/numberInput'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { AtivoCard } from '../../components/ativos/AtivoCard'
import { totalCarteira } from '../../utils/carteira'

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
  crypto: 'Símbolo da moeda, como BTC, ETH ou SOL — cotação em BRL pelo CoinGecko',
}

const brl = (v: number) =>
  v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  const formRef = useRef<HTMLFormElement>(null)
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

  // O botão de editar fica lá embaixo, na lista, e o formulário abre no topo da
  // tela: sem levar a rolagem até ele, o clique parece não ter feito nada.
  // Reage também à troca de ativo em edição, quando o formulário já está aberto.
  useEffect(() => {
    const alvo = formRef.current
    if (!formAberto || !alvo) return

    const semAnimacao = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    alvo.scrollIntoView({ behavior: semAnimacao ? 'auto' : 'smooth', block: 'start' })

    // Foco no container, não no primeiro campo: o leitor de tela anuncia o
    // formulário sem que o teclado do celular suba por cima dele.
    alvo.focus({ preventScroll: true })
  }, [formAberto, editingId])

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
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    )
  }

  const { total, semCotacao } = totalCarteira(ativos)

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1 self-start">
          <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold self-start tabular-nums">
            TOTAL R$ {brl(total)}
          </span>
          {semCotacao > 0 && (
            <span className="text-[11px] text-on-surface-variant">
              {semCotacao} {semCotacao === 1 ? 'ativo sem cotação ficou' : 'ativos sem cotação ficaram'} fora da soma
            </span>
          )}
        </div>
        <button
          onClick={() => (formAberto ? fecharForm() : setFormAberto(true))}
          className="flex items-center justify-center gap-1.5 px-4 min-h-[48px] rounded-xl bg-primary text-on-primary text-sm font-medium w-full md:w-auto"
        >
          <span className="material-symbols-outlined text-[20px]">{formAberto ? 'close' : 'add'}</span>
          {formAberto ? 'Cancelar' : 'Novo ativo'}
        </button>
      </div>

      {formAberto && (
        <form
          ref={formRef}
          tabIndex={-1}
          aria-label={editingId ? 'Editar ativo' : 'Novo ativo'}
          onSubmit={salvar}
          // scroll-mt compensa o header sticky (h-14 no mobile, h-16 no md+),
          // senão o topo do formulário para escondido atrás dele.
          className="scroll-mt-20 md:scroll-mt-24 focus:outline-none rounded-2xl bg-surface-container-lowest border border-outline-variant/50 p-4 space-y-3"
        >
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
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">trending_up</span>
          <h3 className="text-base font-semibold text-on-surface mb-2">Sua carteira está vazia</h3>
          <p className="text-sm text-on-surface-variant mb-6">
            Cadastre um ativo com preço-alvo e receba um aviso no WhatsApp quando a cotação chegar lá.
          </p>
          <button onClick={() => setFormAberto(true)} className="btn-primary mx-auto">
            <span className="material-symbols-outlined text-lg">add</span>
            Adicionar primeiro ativo
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {ativos.map((a) => (
          <AtivoCard
            key={a.id}
            ativo={a}
            onEdit={iniciarEdicao}
            onDelete={setDeleteTarget}
            onReativar={reativar}
          />
        ))}
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
