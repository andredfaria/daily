import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { billsApi } from '../api/bills'
import type { Bill, RecurrenceType } from '../types'
import {
  formatBRL,
  formatDate,
  getBillIcon,
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

// --- Bill Card ---
interface BillCardProps {
  bill: Bill
  onEdit: (id: string) => void
  onToggle: (id: string, active: boolean) => void
  onDelete: (bill: Bill) => void
}

const BillCard: React.FC<BillCardProps> = ({ bill, onEdit, onToggle, onDelete }) => {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

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
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className={`
            w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0
            ${bill.is_active ? 'bg-primary/15' : 'bg-outline/15'}
          `}>
            <span className={`material-symbols-outlined text-lg ${bill.is_active ? 'text-primary' : 'text-outline'}`}>
              {icon}
            </span>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-on-surface leading-tight">{bill.name}</h3>
            <p className="text-xs text-on-surface-variant mt-0.5">{recurrenceDetail}</p>
            {bill.description && (
              <p className="text-xs text-on-surface-variant/70 mt-0.5 line-clamp-1">{bill.description}</p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${recurrenceColor}`}>
            {recurrenceLabel}
          </span>

          {/* Three-dot menu */}
          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-surface-container-high transition-colors text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-base">more_vert</span>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-8 z-20 w-40 bg-surface-container-high border border-outline-variant/50 rounded-xl shadow-xl overflow-hidden animate-fadeIn">
                <button
                  onClick={() => { onEdit(bill.id); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-base">edit</span>
                  Editar
                </button>
                <button
                  onClick={() => { onToggle(bill.id, !bill.is_active); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-on-surface hover:bg-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-base">
                    {bill.is_active ? 'toggle_off' : 'toggle_on'}
                  </span>
                  {bill.is_active ? 'Desativar' : 'Ativar'}
                </button>
                <div className="border-t border-outline-variant/30" />
                <button
                  onClick={() => { onDelete(bill); setMenuOpen(false) }}
                  className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-error hover:bg-error-container/30 transition-colors"
                >
                  <span className="material-symbols-outlined text-base">delete</span>
                  Excluir
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Payment methods */}
      {(hasPix || hasBoleto) && (
        <div className="flex items-center gap-1.5 mb-3">
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
      )}

      {/* Amount */}
      <div className="text-xl font-bold text-primary mb-1">{formatBRL(bill.amount)}</div>

      {/* Due date */}
      {bill.due_date && (
        <p className="text-xs text-on-surface-variant">
          Vence em {formatDate(bill.due_date)}
        </p>
      )}

      {/* Alert */}
      <p className="text-xs text-on-surface-variant/60 mt-1">
        <span className="material-symbols-outlined text-xs align-middle mr-0.5">notifications</span>
        Alerta {bill.days_before_alert} {bill.days_before_alert === 1 ? 'dia' : 'dias'} antes
      </p>

      {/* Active toggle */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-outline-variant/20">
        <span className={`text-xs font-medium ${bill.is_active ? 'text-tertiary' : 'text-outline'}`}>
          {bill.is_active ? 'Ativa' : 'Inativa'}
        </span>
        <button
          onClick={() => onToggle(bill.id, !bill.is_active)}
          className={`
            relative w-10 h-5 rounded-full transition-all duration-300 flex-shrink-0
            ${bill.is_active
              ? 'bg-tertiary shadow-[0_0_8px_rgba(74,225,118,0.4)]'
              : 'bg-outline/30'
            }
          `}
        >
          <span
            className={`
              absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-300
              ${bill.is_active ? 'left-5' : 'left-0.5'}
            `}
          />
        </button>
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
  const [deleteTarget, setDeleteTarget] = useState<Bill | null>(null)
  const [deleting, setDeleting] = useState(false)
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
    try {
      await billsApi.toggle(id, active)
      setBills((prev) => prev.map((b) => (b.id === id ? { ...b, is_active: active } : b)))
      success(active ? 'Conta ativada!' : 'Conta desativada.')
    } catch {
      showError('Erro ao atualizar conta.')
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
    return recMatch && activeMatch
  })

  const totalAmount = filtered.reduce((s, b) => s + b.amount, 0)

  const recurrenceFilters: { value: RecurrenceFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'monthly', label: 'Mensal' },
    { value: 'weekly', label: 'Semanal' },
    { value: 'once', label: 'Avulsa' },
  ]

  const activeFilters: { value: ActiveFilter; label: string }[] = [
    { value: 'all', label: 'Todas' },
    { value: 'active', label: 'Ativas' },
    { value: 'inactive', label: 'Inativas' },
  ]

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold text-on-surface">Minhas Contas</h2>
          <span className="px-2.5 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold">
            TOTAL {formatBRL(totalAmount)}
          </span>
        </div>
        <button onClick={() => navigate('/contas/nova')} className="btn-primary">
          <span className="material-symbols-outlined text-lg">add</span>
          Nova Conta
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Recurrence filter pills */}
        <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1">
          {recurrenceFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setRecurrenceFilter(f.value)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
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

        {/* Active filter pills */}
        <div className="flex items-center gap-1.5 bg-surface-container rounded-xl p-1">
          {activeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setActiveFilter(f.value)}
              className={`
                px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200
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
