import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billsApi } from '../../api/bills'
import { occurrencesApi } from '../../api/occurrences'
import type { Bill, BillCategory, OcorrenciaAtual, RecurrenceType } from '../../types'
import {
  formatBRL,
  formatDate,
  getBillIcon,
  getRecurrenceBadgeColor,
  getRecurrenceLabel,
  getRecurrenceShortLabel,
} from '../../utils/format'
import { formatNumericInput, parseNumericInput } from '../../utils/numberInput'
import NumberField from '../../components/ui/NumberField'
import Modal from '../../components/ui/Modal'
import { SkeletonCard } from '../../components/ui/Skeleton'
import { useToast } from '../../context/ToastContext'
import { useCategorias } from '../../hooks/useCategorias'
import { infoCategoria } from '../../utils/categoriasGasto'
import { rotuloPaga, valorSugeridoDoPagamento } from '../../utils/pagamento'
import Select from '../../components/ui/Select'

// --- Filter types ---
type RecurrenceFilter = 'all' | RecurrenceType
type ActiveFilter = 'all' | 'active' | 'inactive'
type CategoryFilter = 'all' | BillCategory

/**
 * Valor que a conta pesa no mês: na variável, o do vencimento corrente (real ou
 * estimado). A fixa usa sempre o valor da conta — `ocorrencia_atual` agora vem
 * para ela também (por causa do pagamento), mas não muda o que ela pesa.
 */
const valorDoMes = (bill: Bill): number =>
  Number(!bill.is_fixed && bill.ocorrencia_atual ? bill.ocorrencia_atual.amount : bill.amount)

const erroDaApi = (err: unknown, padrao: string): string =>
  (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? padrao

// --- Pagamento do vencimento corrente ---
interface PagamentoDoMesProps {
  bill: Bill
  ocorrencia: OcorrenciaAtual
  onAtualizada: (billId: string, ocorrencia: OcorrenciaAtual) => void
}

/**
 * Marca o vencimento corrente como pago. Fixa: um toque. Variável: pede o valor
 * pago num modal (preenchido com o real, se já houver, senão a estimativa).
 */
const PagamentoDoMes: React.FC<PagamentoDoMesProps> = ({ bill, ocorrencia, onAtualizada }) => {
  const [enviando, setEnviando] = useState(false)
  const [modalAberto, setModalAberto] = useState(false)
  const [valor, setValor] = useState('')
  const { success, error: showError } = useToast()
  const vencimento = formatDate(ocorrencia.due_date, 'dd/MM')

  const pagar = async (amount?: number) => {
    setEnviando(true)
    try {
      onAtualizada(bill.id, await occurrencesApi.pagar(ocorrencia.id, amount))
      success(`${bill.name} marcada como paga.`)
      setModalAberto(false)
    } catch (err) {
      showError(erroDaApi(err, 'Erro ao marcar a conta como paga.'))
    } finally {
      setEnviando(false)
    }
  }

  const desfazer = async () => {
    setEnviando(true)
    try {
      onAtualizada(bill.id, await occurrencesApi.desfazerPagamento(ocorrencia.id))
      success(`${bill.name} voltou para em aberto.`)
    } catch (err) {
      showError(erroDaApi(err, 'Erro ao desfazer o pagamento.'))
    } finally {
      setEnviando(false)
    }
  }

  const marcar = () => {
    if (bill.is_fixed) return pagar()
    setValor(formatNumericInput(valorSugeridoDoPagamento(ocorrencia, bill.amount), 2, { padDecimals: true }))
    setModalAberto(true)
  }

  const confirmarVariavel = () => {
    const amount = parseNumericInput(valor)
    if (amount === null || amount < 0) return showError('Informe o valor pago.')
    pagar(amount)
  }

  const spinner = <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden="true" />

  if (ocorrencia.paid_at) {
    return (
      <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-outline-variant/30">
        <div className="min-w-0">
          <span className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full bg-tertiary/15 text-tertiary">
            <span className="material-symbols-outlined text-sm" aria-hidden="true">check_circle</span>
            {rotuloPaga(ocorrencia.paid_at)}
          </span>
          <p className="text-[11px] text-on-surface-variant mt-1">
            Venc. {vencimento}{ocorrencia.paid_source === 'whatsapp' ? ' · pelo WhatsApp' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={desfazer}
          disabled={enviando}
          aria-busy={enviando}
          aria-label={`Desfazer pagamento de ${bill.name}`}
          className="flex-shrink-0 flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-xs font-semibold text-on-surface-variant hover:text-primary hover:bg-surface-container-high transition-colors disabled:opacity-50 cursor-pointer"
        >
          {enviando ? spinner : <span className="material-symbols-outlined text-base" aria-hidden="true">undo</span>}
          {enviando ? 'Desfazendo…' : 'Desfazer'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 mt-4 pt-3 border-t border-outline-variant/30">
      <p className="flex items-center gap-1 text-xs text-on-surface-variant min-w-0">
        <span className="material-symbols-outlined text-sm" aria-hidden="true">schedule</span>
        Em aberto · vence {vencimento}
      </p>
      <button
        type="button"
        onClick={marcar}
        disabled={enviando}
        aria-busy={enviando}
        className="flex-shrink-0 flex items-center gap-1.5 min-h-[44px] px-3 rounded-lg border border-tertiary/40 text-xs font-semibold text-tertiary hover:bg-tertiary/10 transition-colors disabled:opacity-50 cursor-pointer"
      >
        {enviando && bill.is_fixed ? spinner : <span className="material-symbols-outlined text-base" aria-hidden="true">check_circle</span>}
        {enviando && bill.is_fixed ? 'Marcando…' : 'Marcar como paga'}
      </button>

      {!bill.is_fixed && (
        <Modal
          isOpen={modalAberto}
          onClose={() => !enviando && setModalAberto(false)}
          onConfirm={confirmarVariavel}
          title={`Pagar ${bill.name}`}
          description={`Quanto veio a conta com vencimento em ${vencimento}? O valor fica como o real do mês.`}
          confirmLabel="Confirmar pagamento"
          icon="check_circle"
          loading={enviando}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!enviando) confirmarVariavel()
            }}
          >
            <NumberField
              label="Valor pago"
              mode="currency"
              min={0}
              prefix="R$"
              value={valor}
              onChange={setValor}
              autoFocus
            />
          </form>
        </Modal>
      )}
    </div>
  )
}

// --- Valor do mês (conta variável) ---
interface ValorDoMesProps {
  bill: Bill
  ocorrencia: OcorrenciaAtual
  onAtualizada: (billId: string, ocorrencia: OcorrenciaAtual) => void
}

/** Mostra o valor do vencimento corrente e deixa informar o real no próprio card. */
const ValorDoMes: React.FC<ValorDoMesProps> = ({ bill, ocorrencia, onAtualizada }) => {
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const [salvando, setSalvando] = useState(false)
  const { success, error: showError } = useToast()
  const real = !!Number(ocorrencia.amount_is_actual)

  const abrir = () => {
    setValor(real ? formatNumericInput(Number(ocorrencia.amount), 2, { padDecimals: true }) : '')
    setEditando(true)
  }

  const salvar = async (amount: number | null) => {
    setSalvando(true)
    try {
      onAtualizada(bill.id, await occurrencesApi.setAmount(ocorrencia.id, amount))
      success(amount === null ? 'Voltou para o valor estimado.' : 'Valor do mês salvo!')
      setEditando(false)
    } catch {
      showError('Erro ao salvar o valor do mês.')
    } finally {
      setSalvando(false)
    }
  }

  const enviar = (e: React.FormEvent) => {
    e.preventDefault()
    const amount = parseNumericInput(valor)
    if (amount === null || amount < 0) return showError('Informe o valor do mês.')
    salvar(amount)
  }

  if (editando) {
    return (
      <form onSubmit={enviar} className="mt-4 space-y-2" onKeyDown={(e) => e.key === 'Escape' && setEditando(false)}>
        <NumberField
          label={`Valor real de ${formatDate(ocorrencia.due_date, 'MMMM')}`}
          mode="currency"
          min={0}
          prefix="R$"
          placeholder={formatNumericInput(Number(bill.amount), 2, { padDecimals: true })}
          value={valor}
          onChange={setValor}
          autoFocus
        />
        <div className="flex flex-wrap items-center gap-2">
          <button type="submit" disabled={salvando} className="btn-primary flex-1 justify-center">
            {salvando ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={() => setEditando(false)} className="btn-ghost flex-1 justify-center">
            Cancelar
          </button>
          {real && (
            <button
              type="button"
              disabled={salvando}
              onClick={() => salvar(null)}
              className="w-full min-h-[44px] text-xs text-on-surface-variant hover:text-primary cursor-pointer"
            >
              Voltar para a estimativa ({formatBRL(bill.amount)})
            </button>
          )}
        </div>
      </form>
    )
  }

  return (
    <div className="flex items-end justify-between gap-3 mt-4">
      <div className="min-w-0">
        <div className="text-xl font-bold text-primary">{formatBRL(ocorrencia.amount)}</div>
        <p className="text-xs text-on-surface-variant mt-0.5">
          {real ? 'Valor real' : 'Estimado'} · vence {formatDate(ocorrencia.due_date, 'dd/MM')}
        </p>
      </div>
      <button
        onClick={abrir}
        className="flex-shrink-0 flex items-center gap-1 min-h-[44px] px-3 rounded-lg text-xs font-semibold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
      >
        <span className="material-symbols-outlined text-base">{real ? 'edit' : 'edit_note'}</span>
        {real ? 'Corrigir' : 'Informar valor'}
      </button>
    </div>
  )
}

// --- Bill Card ---
interface BillCardProps {
  bill: Bill
  onEdit: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onDelete: (bill: Bill) => void
  onOcorrenciaAtualizada: (billId: string, ocorrencia: OcorrenciaAtual) => void
  toggling?: string | null
}

const BillCard: React.FC<BillCardProps> = ({ bill, onEdit, onToggle, onDelete, onOcorrenciaAtualizada, toggling }) => {
  const categorias = useCategorias()
  const icon = getBillIcon(bill.name)
  const recurrenceLabel = getRecurrenceShortLabel(bill.recurrence_type)
  const recurrenceColor = getRecurrenceBadgeColor(bill.recurrence_type)
  const recurrenceDetail = getRecurrenceLabel(
    bill.recurrence_type,
    bill.recurrence_day_of_month,
    bill.recurrence_day_of_week,
  )

  const hasPix = bill.payment_methods?.some((m) => m.type === 'pix')
  const hasBoleto = bill.payment_methods?.some((m) => m.type === 'boleto')

  return (
    <div
      className={`
        glass-card rounded-2xl border p-5 transition-all duration-200 group
        ${bill.is_active
          ? 'border-outline-variant/50 hover:border-primary/30'
          : 'border-outline-variant/20 opacity-60'
        }
      `}
    >
      {/* Identity + actions */}
      <div className="flex items-start gap-3">
        <div className={`
          w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
          ${bill.is_active ? 'bg-primary/15' : 'bg-outline/15'}
        `}>
          <span className={`material-symbols-outlined text-lg ${bill.is_active ? 'text-primary' : 'text-outline'}`}>
            {icon}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold text-on-surface leading-tight truncate pt-2">{bill.name}</h3>
            <div className="flex items-center gap-0.5 flex-shrink-0 -mt-1 -mr-1.5">
              <button
                onClick={() => onEdit(bill.id)}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-primary cursor-pointer"
                title="Editar"
                aria-label="Editar conta"
              >
                <span className="material-symbols-outlined text-base">edit</span>
              </button>
              <button
                onClick={() => onToggle(bill.id, !bill.is_active)}
                disabled={toggling === bill.id}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-tertiary disabled:opacity-40 cursor-pointer"
                title={bill.is_active ? 'Desativar' : 'Ativar'}
                aria-label={bill.is_active ? 'Desativar conta' : 'Ativar conta'}
              >
                {toggling === bill.id ? (
                  <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined text-base">
                    {bill.is_active ? 'toggle_on' : 'toggle_off'}
                  </span>
                )}
              </button>
              <button
                onClick={() => onDelete(bill)}
                className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-error cursor-pointer"
                title="Excluir"
                aria-label="Excluir conta"
              >
                <span className="material-symbols-outlined text-base">delete</span>
              </button>
            </div>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5">{recurrenceDetail}</p>
        </div>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap items-center gap-1.5 mt-3">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${recurrenceColor}`}>
          {recurrenceLabel}
        </span>

        <span
          className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
            bill.is_fixed
              ? 'border-outline-variant/40 text-on-surface-variant'
              : 'border-secondary/40 text-secondary'
          }`}
          title={bill.is_fixed ? 'Mesmo valor todo mês' : 'Valor muda todo mês'}
        >
          {bill.is_fixed ? 'Fixa' : 'Variável'}
        </span>

        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
          bill.is_active
            ? 'bg-tertiary/15 text-tertiary'
            : 'bg-outline/15 text-outline'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${bill.is_active ? 'bg-tertiary' : 'bg-outline'}`} />
          {bill.is_active ? 'Ativa' : 'Inativa'}
        </span>

        {bill.category && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant">
            <span className="material-symbols-outlined text-xs" aria-hidden="true">{infoCategoria(bill.category, categorias).icone}</span>
            {infoCategoria(bill.category, categorias).nome}
          </span>
        )}

        {hasPix && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            <span className="material-symbols-outlined text-xs">qr_code</span>
            PIX
          </span>
        )}
        {hasBoleto && (
          <span className="flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary-container/50 text-on-secondary-container border border-outline-variant/20">
            <span className="material-symbols-outlined text-xs">barcode</span>
            BOLETO
          </span>
        )}
      </div>

      {bill.description && (
        <p className="text-xs text-on-surface-variant/70 mt-2 line-clamp-1">{bill.description}</p>
      )}

      {/* Valor do mês da conta variável */}
      {!bill.is_fixed && bill.ocorrencia_atual && (
        <ValorDoMes bill={bill} ocorrencia={bill.ocorrencia_atual} onAtualizada={onOcorrenciaAtualizada} />
      )}

      {/* Amount + due date */}
      <div className="flex items-end justify-between mt-4">
        <div>
          {!bill.is_fixed && bill.ocorrencia_atual ? (
            <p className="text-xs text-on-surface-variant">Estimativa: {formatBRL(bill.amount)}</p>
          ) : (
            <div className="text-xl font-bold text-primary">{formatBRL(bill.amount)}</div>
          )}
          {bill.due_date && (
            <p className="text-xs text-on-surface-variant mt-0.5">
              Vence em {formatDate(bill.due_date)}
            </p>
          )}
        </div>
        <p className="flex items-center gap-1 text-[11px] text-on-surface-variant/60">
          <span className="material-symbols-outlined text-xs">notifications</span>
          {bill.days_before_alert} {bill.days_before_alert === 1 ? 'dia' : 'dias'} antes
        </p>
      </div>

      {/* Pagamento do vencimento corrente (fixa e variável) */}
      {bill.is_active && bill.ocorrencia_atual && (
        <PagamentoDoMes bill={bill} ocorrencia={bill.ocorrencia_atual} onAtualizada={onOcorrenciaAtualizada} />
      )}
    </div>
  )
}

// --- Contas Page ---
const ContasLista: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const categorias = useCategorias()
  // Sem categoria ou de categoria apagada conta como "outro", como na análise.
  const categoriaDaConta = (b: Bill) => infoCategoria(b.category ?? 'outro', categorias).key
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [toggling, setToggling] = useState<string | null>(null)
  const { success, error: showError } = useToast()
  const navigate = useNavigate()

  const fetchBills = useCallback(async () => {
    try {
      setLoading(true)
      const data = await billsApi.list()
      setBills(data)
    } catch {
      showError('Erro ao carregar contas. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [showError])

  useEffect(() => {
    fetchBills()
  }, [fetchBills])

  const handleToggle = async (id: string, active: boolean) => {
    setToggling(id)
    try {
      await billsApi.toggle(id, active)
      setBills((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: active } : b)))
      success(active ? 'Conta ativada!' : 'Conta desativada.')
    } catch {
      showError('Erro ao atualizar conta.')
    } finally {
      setToggling(null)
    }
  }

  const handleDelete = async () => {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await billsApi.delete(deleteTarget.id)
      setBills((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      success('Conta excluída com sucesso.')
      setDeleteTarget(null)
    } catch {
      showError('Erro ao excluir conta.')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = bills.filter((b) => {
    const recMatch = recurrenceFilter === 'all' || b.recurrence_type === recurrenceFilter
    const activeMatch =
      activeFilter === 'all' ||
      (activeFilter === 'active' && b.is_active) ||
      (activeFilter === 'inactive' && !b.is_active)
    const categoryMatch = categoryFilter === 'all' || categoriaDaConta(b) === categoryFilter
    return recMatch && activeMatch && categoryMatch
  })

  const totalAmount = filtered.reduce((s, b) => s + valorDoMes(b), 0)

  const ocorrenciaAtualizada = (billId: string, ocorrencia: OcorrenciaAtual) => {
    // Mescla com o que já havia: a resposta do PATCH de valor pode não trazer
    // paid_at/paid_source, e substituir tudo faria a conta paga parecer em aberto.
    setBills((prev) =>
      prev.map((b) => (b.id === billId ? { ...b, ocorrencia_atual: { ...b.ocorrencia_atual, ...ocorrencia } } : b)),
    )
  }

  // Mesma ideia das categorias: só as recorrências que alguma conta usa, na
  // ordem do mês para o ano. Oito botões fixos tomavam uma linha inteira.
  const ordemRecorrencia: RecurrenceType[] = ['weekly', 'biweekly', 'monthly', 'quarterly', 'semiannual', 'annual', 'once']
  const recorrenciasUsadas = new Set(bills.map((b) => b.recurrence_type))
  const recurrenceFilters: { value: RecurrenceFilter; label: string; icon?: string }[] = [
    { value: 'all', label: 'Recorrências', icon: 'event_repeat' },
    ...ordemRecorrencia
      .filter((r) => recorrenciasUsadas.has(r))
      .map((r) => ({ value: r, label: r === 'once' ? 'Avulsa' : getRecurrenceLabel(r), icon: r === 'once' ? 'event' : 'event_repeat' })),
  ]

  // Só as categorias que alguma conta usa: a lista é a mesma dos gastos e
  // mostrar as onze (mais as criadas) deixaria o filtro cheio de opção vazia.
  const usadas = new Set(bills.map((b) => categoriaDaConta(b)))
  const categoryFilters: { value: CategoryFilter; label: string; icon?: string }[] = [
    { value: 'all', label: 'Categorias', icon: 'category' },
    ...categorias.filter((c) => usadas.has(c.key)).map((c) => ({ value: c.key, label: c.nome, icon: c.icone })),
  ]

  const activeFilters: { value: ActiveFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Ativas' },
    { value: 'inactive', label: 'Inativas' },
  ]

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header — sem título: o Header da app e a TabNav já situam a página */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold self-start">
          TOTAL {formatBRL(totalAmount)}
        </span>
        <button onClick={() => navigate('/contas/nova')} className="btn-primary justify-center w-full md:w-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Nova Conta
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Active filter pills */}
        <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1">
          {activeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`
                min-h-[44px] px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer
                ${activeFilter === f.value
                  ? 'bg-surface-container-high text-on-surface shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Recurrence filter select */}
        <Select
          variant="chip"
          aria-label="Filtrar por recorrência"
          value={recurrenceFilter}
          onChange={setRecurrenceFilter}
          ativo={recurrenceFilter !== 'all'}
          options={recurrenceFilters}
        />

        {/* Category filter select */}
        <Select
          variant="chip"
          aria-label="Filtrar por categoria"
          value={categoryFilter}
          onChange={setCategoryFilter}
          ativo={categoryFilter !== 'all'}
          options={categoryFilters}
        />

        <span className="text-xs text-on-surface-variant ml-auto">
          {filtered.length} conta{filtered.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Bento Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass-card rounded-2xl border border-outline-variant/50 p-16 text-center">
          <span className="material-symbols-outlined text-5xl text-on-surface-variant mb-4 block">
            receipt_long
          </span>
          <h3 className="text-base font-semibold text-on-surface mb-2">
            {bills.length === 0 ? 'Nenhuma conta cadastrada' : 'Nenhuma conta encontrada'}
          </h3>
          <p className="text-sm text-on-surface-variant mb-6">
            {bills.length === 0
              ? 'Adicione sua primeira conta para começar a gerenciar seus pagamentos.'
              : 'Tente mudar os filtros para ver mais contas.'}
          </p>
          {bills.length === 0 && (
            <button onClick={() => navigate('/contas/nova')} className="btn-primary mx-auto">
              <span className="material-symbols-outlined text-lg">add</span>
              Adicionar Primeira Conta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((bill) => (
            <BillCard
              key={bill.id}
              bill={bill}
              onEdit={(id) => navigate(`/contas/${id}/editar`)}
              onToggle={handleToggle}
              onDelete={setDeleteTarget}
              onOcorrenciaAtualizada={ocorrenciaAtualizada}
              toggling={toggling}
            />
          ))}
        </div>
      )}

      {/* Delete Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        title="Excluir Conta"
        description={`Tem certeza que deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita e todos os dados relacionados serão perdidos.`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        variant="danger"
        loading={deleting}
      />
    </div>
  )
}

export default ContasLista
