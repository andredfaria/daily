import React, { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { billsApi } from '../api/bills'
import type { PaymentMethod, PixKeyType, RecurrenceType } from '../types'
import { useToast } from '../context/ToastContext'

// --- Types ---
interface PaymentMethodDraft {
  draftId: string
  id?: string
  type: 'pix' | 'boleto'
  pix_key_type: PixKeyType
  pix_key: string
  pix_beneficiary: string
  boleto_code: string
  is_primary: boolean
}

interface FormErrors {
  name?: string
  amount?: string
  recurrence_type?: string
  due_date?: string
  recurrence_day_of_month?: string
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

const makeDraft = (): PaymentMethodDraft => ({
  draftId: Math.random().toString(36).slice(2),
  type: 'pix',
  pix_key_type: 'cpf',
  pix_key: '',
  pix_beneficiary: '',
  boleto_code: '',
  is_primary: false,
})

// --- Payment Method Card ---
interface PaymentMethodCardProps {
  method: PaymentMethodDraft
  index: number
  onChange: (draftId: string, field: keyof PaymentMethodDraft, value: unknown) => void
  onRemove: (draftId: string) => void
  canRemove: boolean
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({
  method,
  index,
  onChange,
  onRemove,
  canRemove,
}) => {
  return (
    <div className="glass-card rounded-xl border border-outline-variant/50 p-4 mb-3">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold text-on-surface-variant uppercase tracking-wide">
          Método {index + 1}
        </span>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={method.is_primary}
              onChange={(e) => onChange(method.draftId, 'is_primary', e.target.checked)}
              className="w-3.5 h-3.5 accent-primary"
            />
            <span className="text-xs text-on-surface-variant">Principal</span>
          </label>
          {canRemove && (
            <button
              type="button"
              onClick={() => onRemove(method.draftId)}
              className="w-6 h-6 flex items-center justify-center rounded-lg hover:bg-error/20 text-on-surface-variant hover:text-error transition-colors"
            >
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Type Tabs */}
      <div className="flex bg-surface-container rounded-lg p-0.5 mb-3">
        {(['pix', 'boleto'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange(method.draftId, 'type', t)}
            className={`
              flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-all duration-200
              ${method.type === t
                ? 'bg-surface-container-high text-on-surface shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
              }
            `}
          >
            <span className="material-symbols-outlined text-sm">
              {t === 'pix' ? 'qr_code' : 'barcode'}
            </span>
            {t.toUpperCase()}
          </button>
        ))}
      </div>

      {method.type === 'pix' ? (
        <div className="space-y-3">
          {/* PIX Key Type */}
          <div>
            <label className="label">Tipo de Chave</label>
            <select
              value={method.pix_key_type}
              onChange={(e) => onChange(method.draftId, 'pix_key_type', e.target.value)}
              className="input-field"
            >
              <option value="cpf">CPF</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Aleatória</option>
            </select>
          </div>
          <div>
            <label className="label">Chave PIX</label>
            <input
              type="text"
              value={method.pix_key}
              onChange={(e) => onChange(method.draftId, 'pix_key', e.target.value)}
              placeholder="Digite a chave PIX"
              className="input-field"
            />
          </div>
          <div>
            <label className="label">Beneficiário</label>
            <input
              type="text"
              value={method.pix_beneficiary}
              onChange={(e) => onChange(method.draftId, 'pix_beneficiary', e.target.value)}
              placeholder="Nome do beneficiário"
              className="input-field"
            />
          </div>
        </div>
      ) : (
        <div>
          <label className="label">Código do Boleto</label>
          <input
            type="text"
            value={method.boleto_code}
            onChange={(e) => onChange(method.draftId, 'boleto_code', e.target.value)}
            placeholder="Digite o código de barras"
            className="input-field font-mono text-xs"
          />
        </div>
      )}
    </div>
  )
}

// --- BillForm Page ---
const BillForm: React.FC = () => {
  const { id } = useParams<{ id?: string }>()
  const navigate = useNavigate()
  const { success, error: showError } = useToast()
  const isEdit = !!id

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState<number>(1)
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [dueDate, setDueDate] = useState('')
  const [daysBeforeAlert, setDaysBeforeAlert] = useState(3)
  const [isActive, setIsActive] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDraft[]>([makeDraft()])
  const [errors, setErrors] = useState<FormErrors>({})
  const [loading, setLoading] = useState(false)
  const [fetchLoading, setFetchLoading] = useState(isEdit)

  // Original payment methods from server (for edit mode)
  const [originalMethods, setOriginalMethods] = useState<PaymentMethod[]>([])

  const loadBill = useCallback(async () => {
    if (!id) return
    try {
      setFetchLoading(true)
      const bill = await billsApi.get(id)
      setName(bill.name)
      setDescription(bill.description ?? '')
      setAmount(bill.amount.toString())
      setRecurrenceType(bill.recurrence_type)
      setDayOfMonth(bill.recurrence_day_of_month ?? 1)
      setDayOfWeek(bill.recurrence_day_of_week ?? 1)
      setDueDate(bill.due_date ?? '')
      setDaysBeforeAlert(bill.days_before_alert)
      setIsActive(bill.is_active)

      if (bill.payment_methods && bill.payment_methods.length > 0) {
        setOriginalMethods(bill.payment_methods)
        setPaymentMethods(
          bill.payment_methods.map((m) => ({
            draftId: m.id,
            id: m.id,
            type: m.type,
            pix_key_type: m.pix_key_type ?? 'cpf',
            pix_key: m.pix_key ?? '',
            pix_beneficiary: m.pix_beneficiary ?? '',
            boleto_code: m.boleto_code ?? '',
            is_primary: m.is_primary,
          })),
        )
      }
    } catch {
      showError('Erro ao carregar conta.')
      navigate('/contas')
    } finally {
      setFetchLoading(false)
    }
  }, [id, navigate, showError])

  useEffect(() => {
    if (isEdit) loadBill()
  }, [isEdit, loadBill])

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Nome é obrigatório'
    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      errs.amount = 'Valor inválido'
    }
    if (!recurrenceType) errs.recurrence_type = 'Recorrência é obrigatória'
    if (recurrenceType === 'monthly' && (!dayOfMonth || dayOfMonth < 1 || dayOfMonth > 31)) {
      errs.recurrence_day_of_month = 'Dia inválido (1-31)'
    }
    if (recurrenceType === 'once' && !dueDate) errs.due_date = 'Data de vencimento obrigatória'
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/[^\d,.]/, '')
    setAmount(val)
  }

  const handleMethodChange = (
    draftId: string,
    field: keyof PaymentMethodDraft,
    value: unknown,
  ) => {
    setPaymentMethods((prev) =>
      prev.map((m) => (m.draftId === draftId ? { ...m, [field]: value } : m)),
    )
  }

  const handleAddMethod = () => {
    setPaymentMethods((prev) => [...prev, makeDraft()])
  }

  const handleRemoveMethod = (draftId: string) => {
    setPaymentMethods((prev) => prev.filter((m) => m.draftId !== draftId))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        description: description.trim() || undefined,
        amount: parseFloat(amount.replace(',', '.')),
        recurrence_type: recurrenceType,
        recurrence_day_of_month: recurrenceType === 'monthly' ? dayOfMonth : undefined,
        recurrence_day_of_week: recurrenceType === 'weekly' ? dayOfWeek : undefined,
        due_date: recurrenceType === 'once' ? dueDate : undefined,
        days_before_alert: daysBeforeAlert,
        is_active: isActive,
      }

      let billId: string
      if (isEdit && id) {
        const updated = await billsApi.update(id, payload)
        billId = updated.id

        // Handle payment methods update
        // Delete methods not in current draft
        const currentIds = paymentMethods.filter((m) => m.id).map((m) => m.id!)
        const toDelete = originalMethods.filter((m) => !currentIds.includes(m.id))
        await Promise.all(toDelete.map((m) => billsApi.deletePaymentMethod(billId, m.id)))

        // Add new methods (no id)
        const newMethods = paymentMethods.filter((m) => !m.id)
        await Promise.all(
          newMethods.map((m) =>
            billsApi.addPaymentMethod(billId, {
              type: m.type,
              pix_key_type: m.type === 'pix' ? m.pix_key_type : undefined,
              pix_key: m.type === 'pix' ? m.pix_key : undefined,
              pix_beneficiary: m.type === 'pix' ? m.pix_beneficiary : undefined,
              boleto_code: m.type === 'boleto' ? m.boleto_code : undefined,
              is_primary: m.is_primary,
            }),
          ),
        )

        success('Conta atualizada com sucesso!')
      } else {
        const created = await billsApi.create(payload)
        billId = created.id

        // Add payment methods
        const validMethods = paymentMethods.filter(
          (m) => (m.type === 'pix' && m.pix_key) || (m.type === 'boleto' && m.boleto_code),
        )
        await Promise.all(
          validMethods.map((m) =>
            billsApi.addPaymentMethod(billId, {
              type: m.type,
              pix_key_type: m.type === 'pix' ? m.pix_key_type : undefined,
              pix_key: m.type === 'pix' ? m.pix_key : undefined,
              pix_beneficiary: m.type === 'pix' ? m.pix_beneficiary : undefined,
              boleto_code: m.type === 'boleto' ? m.boleto_code : undefined,
              is_primary: m.is_primary,
            }),
          ),
        )

        success('Conta criada com sucesso!')
      }

      navigate('/contas')
    } catch {
      showError('Erro ao salvar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fadeIn max-w-5xl">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm">
        <button
          onClick={() => navigate('/contas')}
          className="text-on-surface-variant hover:text-on-surface transition-colors"
        >
          Contas
        </button>
        <span className="material-symbols-outlined text-sm text-outline">chevron_right</span>
        <span className="text-on-surface font-medium">
          {isEdit ? 'Editar Conta' : 'Nova Conta'}
        </span>
      </nav>

      <form onSubmit={handleSubmit}>
        <div className="grid grid-cols-12 gap-6">
          {/* Left: Bill Info */}
          <div className="col-span-12 lg:col-span-7">
            <div className="section-card space-y-5">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                <h3 className="text-base font-semibold text-on-surface">Informações da Conta</h3>
              </div>

              {/* Nome */}
              <div>
                <label className="label">Nome *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex: Netflix, Aluguel, Energia..."
                  className={`input-field ${errors.name ? 'error' : ''}`}
                />
                {errors.name && (
                  <p className="text-xs text-error mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.name}
                  </p>
                )}
              </div>

              {/* Descrição */}
              <div>
                <label className="label">Descrição</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Observações sobre esta conta..."
                  rows={2}
                  className="input-field resize-none"
                />
              </div>

              {/* Valor */}
              <div>
                <label className="label">Valor *</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant text-sm font-medium">
                    R$
                  </span>
                  <input
                    type="text"
                    value={amount}
                    onChange={handleAmountChange}
                    placeholder="0,00"
                    className={`input-field pl-10 ${errors.amount ? 'error' : ''}`}
                  />
                </div>
                {errors.amount && (
                  <p className="text-xs text-error mt-1 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.amount}
                  </p>
                )}
              </div>

              {/* Recorrência */}
              <div>
                <label className="label">Recorrência *</label>
                <select
                  value={recurrenceType}
                  onChange={(e) => setRecurrenceType(e.target.value as RecurrenceType)}
                  className="input-field"
                >
                  <option value="monthly">Mensal</option>
                  <option value="weekly">Semanal</option>
                  <option value="once">Avulsa</option>
                </select>
              </div>

              {/* Dynamic field based on recurrence type */}
              {recurrenceType === 'monthly' && (
                <div>
                  <label className="label">Dia do Mês *</label>
                  <input
                    type="number"
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(parseInt(e.target.value))}
                    min={1}
                    max={31}
                    className={`input-field ${errors.recurrence_day_of_month ? 'error' : ''}`}
                  />
                  {errors.recurrence_day_of_month && (
                    <p className="text-xs text-error mt-1">{errors.recurrence_day_of_month}</p>
                  )}
                </div>
              )}

              {recurrenceType === 'weekly' && (
                <div>
                  <label className="label">Dia da Semana</label>
                  <div className="flex gap-2 flex-wrap">
                    {WEEKDAYS.map((day, idx) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => setDayOfWeek(idx)}
                        className={`
                          px-3 py-2 rounded-xl text-sm font-semibold transition-all duration-200
                          ${dayOfWeek === idx
                            ? 'bg-primary text-on-primary-fixed shadow-md'
                            : 'bg-surface-container text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high'
                          }
                        `}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {recurrenceType === 'once' && (
                <div>
                  <label className="label">Data de Vencimento *</label>
                  <input
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                    className={`input-field ${errors.due_date ? 'error' : ''}`}
                  />
                  {errors.due_date && (
                    <p className="text-xs text-error mt-1">{errors.due_date}</p>
                  )}
                </div>
              )}

              {/* Days before alert */}
              <div>
                <label className="label">Antecedência de Alerta (dias)</label>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setDaysBeforeAlert((v) => Math.max(0, v - 1))}
                    className="w-9 h-9 rounded-xl bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">remove</span>
                  </button>
                  <span className="w-12 text-center text-base font-semibold text-on-surface">
                    {daysBeforeAlert}
                  </span>
                  <button
                    type="button"
                    onClick={() => setDaysBeforeAlert((v) => Math.min(30, v + 1))}
                    className="w-9 h-9 rounded-xl bg-surface-container border border-outline-variant/50 flex items-center justify-center text-on-surface hover:bg-surface-container-high transition-colors"
                  >
                    <span className="material-symbols-outlined text-base">add</span>
                  </button>
                  <span className="text-xs text-on-surface-variant">
                    Aviso {daysBeforeAlert} dia{daysBeforeAlert !== 1 ? 's' : ''} antes
                  </span>
                </div>
              </div>

              {/* Active status */}
              <div className="flex items-center justify-between py-3 border-t border-outline-variant/30">
                <div>
                  <p className="text-sm font-medium text-on-surface">Conta Ativa</p>
                  <p className="text-xs text-on-surface-variant">Ativa gera notificações e alertas</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive((v) => !v)}
                  className={`
                    relative w-12 h-6 rounded-full transition-all duration-300
                    ${isActive ? 'bg-tertiary shadow-[0_0_8px_rgba(74,225,118,0.4)]' : 'bg-outline/30'}
                  `}
                >
                  <span
                    className={`
                      absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-300
                      ${isActive ? 'left-7' : 'left-1'}
                    `}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Payment Methods */}
          <div className="col-span-12 lg:col-span-5">
            <div className="section-card">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">payments</span>
                  <h3 className="text-base font-semibold text-on-surface">Métodos de Pagamento</h3>
                </div>
              </div>

              <div>
                {paymentMethods.map((method, index) => (
                  <PaymentMethodCard
                    key={method.draftId}
                    method={method}
                    index={index}
                    onChange={handleMethodChange}
                    onRemove={handleRemoveMethod}
                    canRemove={paymentMethods.length > 1}
                  />
                ))}

                <button
                  type="button"
                  onClick={handleAddMethod}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-outline-variant/50 text-xs font-semibold text-on-surface-variant hover:text-primary hover:border-primary/50 transition-all duration-200"
                >
                  <span className="material-symbols-outlined text-base">add</span>
                  Adicionar Método
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-end gap-3 mt-6 pt-5 border-t border-outline-variant/30">
          <button
            type="button"
            onClick={() => navigate('/contas')}
            className="btn-ghost"
          >
            Cancelar
          </button>
          <button type="submit" disabled={loading} className="btn-primary">
            {loading && (
              <span className="w-4 h-4 border-2 border-on-primary-fixed border-t-transparent rounded-full animate-spin" />
            )}
            <span className="material-symbols-outlined text-lg">save</span>
            {isEdit ? 'Atualizar Conta' : 'Salvar Conta'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default BillForm
