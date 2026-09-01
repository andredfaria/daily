import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billsApi } from '../api/bills'
import type { Bill, BillCategory, RecurrenceType } from '../types'
import {
  formatBRL,
  formatDate,
  getBillIcon,
  getCategoryLabel,
  getRecurrenceBadgeColor,
  getRecurrenceLabel,
  getRecurrenceShortLabel,
} from '../utils/format'
import Modal from '../components/ui/Modal'
import { SkeletonCard } from '../components/ui/Skeleton'
import { useToast } from '../context/ToastContext'

// --- Filter types ---
type RecurrenceFilter = 'all' | RecurrenceType
type ActiveFilter = 'all' | 'active' | 'inactive'
type CategoryFilter = 'all' | BillCategory

// --- Bill Card ---
interface BillCardProps {
  bill: Bill
  onEdit: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onDelete: (bill: Bill) => void
  toggling?: string | null
}

const BillCard: React.FC<BillCardProps> = ({ bill, onEdit, onToggle, onDelete, toggling }) => {
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

        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full flex items-center gap-1 ${
          bill.is_active
            ? 'bg-tertiary/15 text-tertiary'
            : 'bg-outline/15 text-outline'
        }`}>
          <span className={`w-1.5 h-1.5 rounded-full ${bill.is_active ? 'bg-tertiary' : 'bg-outline'}`} />
          {bill.is_active ? 'Ativa' : 'Inativa'}
        </span>

        {bill.category && (
          <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-surface-variant text-on-surface-variant">
            {getCategoryLabel(bill.category)}
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

      {/* Amount + due date */}
      <div className="flex items-end justify-between mt-4">
        <div>
          <div className="text-xl font-bold text-primary">{formatBRL(bill.amount)}</div>
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
    </div>
  )
}

// --- Contas Page ---
const Contas: React.FC = () => {
  const [bills, setBills] = useState<Bill[]>([])
  const [loading, setLoading] = useState(true)
  const [recurrenceFilter, setRecurrenceFilter] = useState<RecurrenceFilter>('all')
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>('active')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
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
    const categoryMatch = categoryFilter === 'all' || b.category === categoryFilter
    return recMatch && activeMatch && categoryMatch
  })

  const totalAmount = filtered.reduce((s, b) => s + Number(b.amount), 0)

  const recurrenceFilters: { value: RecurrenceFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'monthly', label: 'Mensal' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'biweekly', label: 'Quinzenal' },
    { value: 'quarterly', label: 'Trimestral' },
    { value: 'semiannual', label: 'Semestral' },
    { value: 'annual', label: 'Anual' },
    { value: 'once', label: 'Avulsa' },
  ]

  const categoryFilters: { value: CategoryFilter; label: string }[] = [
    { value: 'all', label: 'Categorias' },
    { value: 'moradia', label: 'Moradia' },
    { value: 'assinaturas', label: 'Assinaturas' },
    { value: 'serviços', label: 'Serviços' },
    { value: 'saúde', label: 'Saúde' },
    { value: 'educação', label: 'Educação' },
    { value: 'transporte', label: 'Transporte' },
    { value: 'alimentação', label: 'Alimentação' },
    { value: 'outro', label: 'Outro' },
  ]

  const activeFilters: { value: ActiveFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Ativas' },
    { value: 'inactive', label: 'Inativas' },
  ]

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-bold text-on-surface">Minhas Contas</h2>
          <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            TOTAL {formatBRL(totalAmount)}
          </span>
        </div>
        <button onClick={() => navigate('/contas/nova')} className="btn-primary justify-center w-full md:w-auto">
          <span className="material-symbols-outlined text-lg">add</span>
          Nova Conta
        </button>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Recurrence filter pills — contained horizontal scroll on mobile */}
        <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1 overflow-x-auto no-scrollbar">
          {recurrenceFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setRecurrenceFilter(f.value)}
              className={`
                flex-shrink-0 min-h-[44px] px-3 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer
                ${recurrenceFilter === f.value
                  ? 'bg-primary text-on-primary-fixed shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
                }
              `}
            >
              {f.label}
            </button>
          ))}
        </div>

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

          {/* Category filter select */}
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
            aria-label="Filtrar por categoria"
            className="min-h-[44px] px-3 rounded-xl text-xs font-semibold bg-surface-container text-on-surface-variant border-none outline-none cursor-pointer hover:text-on-surface transition-colors"
          >
            {categoryFilters.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>

          <span className="text-xs text-on-surface-variant ml-auto">
            {filtered.length} conta{filtered.length !== 1 ? 's' : ''}
          </span>
        </div>
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

export default Contas
