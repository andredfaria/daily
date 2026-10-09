import React, { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { billsApi, type CreatePaymentMethodPayload } from '../api/bills'
import type { PaymentMethod, PixKeyType, RecurrenceType } from '../types'
import { useToast } from '../context/ToastContext'
import NumberField from '../components/ui/NumberField'
import { formatNumericInput, parseNumericInput } from '../utils/numberInput'
import { formatBRL, formatDate, getBillIcon } from '../utils/format'
import { useCategorias } from '../hooks/useCategorias'
import { infoCategoria } from '../utils/categoriasGasto'

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
  recurrence_day_of_month?: string
  due_date?: string
}

// Ordem dos campos na tela: o foco vai para o primeiro com erro.
const CAMPO_DO_ERRO: Record<keyof FormErrors, string> = {
  name: 'conta-nome',
  amount: 'conta-valor',
  recurrence_day_of_month: 'conta-dia',
  due_date: 'conta-vencimento',
}

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const WEEKDAYS_LONGO = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']

const RECORRENCIAS: { value: RecurrenceType; label: string }[] = [
  { value: 'monthly', label: 'Mensal' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'biweekly', label: 'Quinzenal' },
  { value: 'quarterly', label: 'Trimestral' },
  { value: 'semiannual', label: 'Semestral' },
  { value: 'annual', label: 'Anual' },
  { value: 'once', label: 'Uma vez' },
]

const POR_DIA_DO_MES: RecurrenceType[] = ['monthly', 'quarterly', 'semiannual', 'annual']
const POR_DIA_DA_SEMANA: RecurrenceType[] = ['weekly', 'biweekly']

// Teclado certo no celular para cada tipo de chave.
const PIX_INPUT_MODE: Record<PixKeyType, 'numeric' | 'email' | 'tel' | 'text'> = {
  cpf: 'numeric',
  email: 'email',
  phone: 'tel',
  random: 'text',
}

const PIX_PLACEHOLDER: Record<PixKeyType, string> = {
  cpf: '000.000.000-00',
  email: 'nome@exemplo.com',
  phone: '+55 11 99999-9999',
  random: 'Cole a chave aleatória',
}

const makeDraft = (type: 'pix' | 'boleto', is_primary: boolean): PaymentMethodDraft => ({
  draftId: Math.random().toString(36).slice(2),
  type,
  pix_key_type: 'cpf',
  pix_key: '',
  pix_beneficiary: '',
  boleto_code: '',
  is_primary,
})

/** Método sem chave nem código não vira registro: o card vazio é só rascunho. */
const preenchido = (m: PaymentMethodDraft) =>
  m.type === 'pix' ? m.pix_key.trim() !== '' : m.boleto_code.trim() !== ''

const payloadDoMetodo = (m: PaymentMethodDraft): CreatePaymentMethodPayload => ({
  type: m.type,
  pix_key_type: m.type === 'pix' ? m.pix_key_type : undefined,
  pix_key: m.type === 'pix' ? m.pix_key.trim() : undefined,
  pix_beneficiary: m.type === 'pix' ? m.pix_beneficiary.trim() : undefined,
  boleto_code: m.type === 'boleto' ? m.boleto_code : undefined,
  is_primary: m.is_primary,
})

/** O método salvo mudou? Compara com o que veio do servidor, campo a campo. */
const mudou = (m: PaymentMethodDraft, original: PaymentMethod): boolean => {
  const p = payloadDoMetodo(m)
  if (p.type !== original.type || !!p.is_primary !== !!original.is_primary) return true
  if (p.type === 'boleto') return p.boleto_code !== (original.boleto_code ?? '')
  return (
    p.pix_key_type !== original.pix_key_type ||
    p.pix_key !== (original.pix_key ?? '') ||
    p.pix_beneficiary !== (original.pix_beneficiary ?? '')
  )
}

/** Frase do vencimento para o resumo: "Todo mês, dia 10", "Toda segunda"... */
const fraseVencimento = (tipo: RecurrenceType, dia: string, diaSemana: number, data: string): string => {
  const d = parseNumericInput(dia)
  const noDia = d ? `dia ${d}` : 'dia —'
  if (tipo === 'monthly') return `Todo mês, ${noDia}`
  if (tipo === 'quarterly') return `A cada 3 meses, ${noDia}`
  if (tipo === 'semiannual') return `A cada 6 meses, ${noDia}`
  if (tipo === 'annual') return `Uma vez por ano, ${noDia}`
  if (tipo === 'weekly') return `Toda ${WEEKDAYS_LONGO[diaSemana]}`
  if (tipo === 'biweekly') return `A cada 15 dias, ${WEEKDAYS_LONGO[diaSemana]}`
  return data ? `Em ${formatDate(data)}` : 'Data a definir'
}

// --- Peças visuais ---

interface SecaoProps {
  id: string
  icone: string
  titulo: string
  descricao?: string
  children: React.ReactNode
}

const Secao: React.FC<SecaoProps> = ({ id, icone, titulo, descricao, children }) => (
  <section className="section-card space-y-5" aria-labelledby={id}>
    <header className="flex items-start gap-3">
      <span
        className="material-symbols-outlined flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-xl text-primary"
        aria-hidden="true"
      >
        {icone}
      </span>
      <div>
        <h2 id={id} className="text-base font-semibold text-on-surface">{titulo}</h2>
        {descricao && <p className="mt-0.5 text-xs text-on-surface-variant">{descricao}</p>}
      </div>
    </header>
    {children}
  </section>
)

/** Pílula de escolha única dentro de um radiogroup. Alvo de toque de 44px. */
const Opcao: React.FC<{ ativa: boolean; onClick: () => void; children: React.ReactNode; className?: string }> = ({
  ativa,
  onClick,
  children,
  className = '',
}) => (
  <button
    type="button"
    role="radio"
    aria-checked={ativa}
    onClick={onClick}
    className={`flex min-h-[44px] min-w-0 cursor-pointer items-center justify-center gap-1.5 rounded-xl border px-3 text-sm font-medium transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      ativa
        ? 'border-primary bg-primary/15 text-primary'
        : 'border-outline-variant/60 bg-surface-container text-on-surface-variant hover:border-outline hover:text-on-surface'
    } ${className}`}
  >
    {children}
  </button>
)

interface InterruptorProps {
  id: string
  ligado: boolean
  onChange: (v: boolean) => void
  rotulo: string
  descricao: string
}

const Interruptor: React.FC<InterruptorProps> = ({ id, ligado, onChange, rotulo, descricao }) => (
  <div className="flex items-center justify-between gap-4">
    <div>
      <p id={id} className="text-sm font-medium text-on-surface">{rotulo}</p>
      <p className="text-xs text-on-surface-variant">{descricao}</p>
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={ligado}
      aria-labelledby={id}
      onClick={() => onChange(!ligado)}
      className="relative flex h-11 w-14 shrink-0 cursor-pointer items-center justify-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <span className={`h-7 w-12 rounded-full transition-colors duration-200 ${ligado ? 'bg-tertiary' : 'bg-outline/40'}`} />
      <span
        className={`absolute left-1/2 top-1/2 -ml-2.5 h-5 w-5 -translate-y-1/2 rounded-full bg-white shadow transition-transform duration-200 ${
          ligado ? 'translate-x-[10px]' : '-translate-x-[10px]'
        }`}
      />
    </button>
  </div>
)

// --- Payment Method Card ---
interface PaymentMethodCardProps {
  method: PaymentMethodDraft
  index: number
  total: number
  onChange: (draftId: string, field: keyof PaymentMethodDraft, value: unknown) => void
  onPrimary: (draftId: string) => void
  onRemove: (draftId: string) => void
}

const PaymentMethodCard: React.FC<PaymentMethodCardProps> = ({ method, index, total, onChange, onPrimary, onRemove }) => {
  const rotulo = method.type === 'pix' ? 'PIX' : 'Boleto'
  const nomeCompleto = total > 1 ? `${rotulo} ${index + 1}` : rotulo

  return (
    <div className="rounded-xl border border-outline-variant/50 bg-surface-container/40 p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="material-symbols-outlined text-lg text-primary" aria-hidden="true">
            {method.type === 'pix' ? 'qr_code' : 'barcode'}
          </span>
          <span className="text-sm font-semibold text-on-surface">{nomeCompleto}</span>
          {method.is_primary && total > 1 && (
            <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">Principal</span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {total > 1 && !method.is_primary && (
            <button
              type="button"
              onClick={() => onPrimary(method.draftId)}
              className="min-h-[44px] cursor-pointer rounded-lg px-3 text-xs font-medium text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
            >
              Tornar principal
            </button>
          )}
          <button
            type="button"
            onClick={() => onRemove(method.draftId)}
            aria-label={`Remover ${nomeCompleto}`}
            className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg text-on-surface-variant transition-colors hover:bg-error/15 hover:text-error"
          >
            <span className="material-symbols-outlined text-lg">delete</span>
          </button>
        </div>
      </div>

      {method.type === 'pix' ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
          <div>
            <label htmlFor={`pix-tipo-${method.draftId}`} className="label">Tipo de chave</label>
            <select
              id={`pix-tipo-${method.draftId}`}
              value={method.pix_key_type}
              onChange={(e) => onChange(method.draftId, 'pix_key_type', e.target.value)}
              className="input-field"
            >
              <option value="cpf">CPF/CNPJ</option>
              <option value="email">E-mail</option>
              <option value="phone">Telefone</option>
              <option value="random">Aleatória</option>
            </select>
          </div>
          <div>
            <label htmlFor={`pix-chave-${method.draftId}`} className="label">Chave PIX</label>
            <input
              id={`pix-chave-${method.draftId}`}
              type="text"
              inputMode={PIX_INPUT_MODE[method.pix_key_type]}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              value={method.pix_key}
              // Chave PIX nunca tem espaço; o que vem colado do app do banco às vezes tem.
              onChange={(e) => onChange(method.draftId, 'pix_key', e.target.value.replace(/\s/g, ''))}
              placeholder={PIX_PLACEHOLDER[method.pix_key_type]}
              className="input-field"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor={`pix-beneficiario-${method.draftId}`} className="label">
              Beneficiário <span className="font-normal normal-case tracking-normal">(opcional)</span>
            </label>
            <input
              id={`pix-beneficiario-${method.draftId}`}
              type="text"
              autoComplete="off"
              value={method.pix_beneficiary}
              onChange={(e) => onChange(method.draftId, 'pix_beneficiary', e.target.value)}
              placeholder="Quem recebe — aparece no lembrete"
              className="input-field"
            />
          </div>
        </div>
      ) : (
        <div>
          <label htmlFor={`boleto-${method.draftId}`} className="label">Linha digitável</label>
          <input
            id={`boleto-${method.draftId}`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            spellCheck={false}
            value={method.boleto_code}
            // Linha digitável só tem dígitos: pontos e espaços colados do PDF caem
            // fora e o código chega limpo no lembrete, pronto para colar no banco.
            onChange={(e) => onChange(method.draftId, 'boleto_code', e.target.value.replace(/\D/g, '').slice(0, 48))}
            placeholder="Cole o código do boleto"
            aria-describedby={`boleto-${method.draftId}-hint`}
            className="input-field font-mono tabular-nums"
          />
          <p id={`boleto-${method.draftId}-hint`} className="mt-1 text-xs text-on-surface-variant">
            {method.boleto_code.length > 0
              ? `${method.boleto_code.length} dígitos (boleto tem 47; conta de consumo, 48)`
              : 'Pode colar com pontos e espaços — só os números ficam'}
          </p>
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
  const categorias = useCategorias()
  const isEdit = !!id

  // Form state
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [description, setDescription] = useState('')
  const [mostrarDescricao, setMostrarDescricao] = useState(false)
  const [amount, setAmount] = useState('')
  const [isFixed, setIsFixed] = useState(true)
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>('monthly')
  const [dayOfMonth, setDayOfMonth] = useState('')
  const [dayOfWeek, setDayOfWeek] = useState<number>(1)
  const [dueDate, setDueDate] = useState('')
  const [daysBeforeAlert, setDaysBeforeAlert] = useState(3)
  const [isActive, setIsActive] = useState(true)
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodDraft[]>([])
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
      setCategory(bill.category ?? '')
      setDescription(bill.description ?? '')
      setMostrarDescricao(!!bill.description)
      setAmount(formatNumericInput(Number(bill.amount), 2, { padDecimals: true }))
      setIsFixed(!!bill.is_fixed)
      setRecurrenceType(bill.recurrence_type)
      setDayOfMonth(bill.recurrence_day_of_month ? String(bill.recurrence_day_of_month) : '')
      setDayOfWeek(bill.recurrence_day_of_week ?? 1)
      setDueDate(bill.due_date ? String(bill.due_date).slice(0, 10) : '')
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

  const limparErro = (campo: keyof FormErrors) =>
    setErrors((prev) => (prev[campo] ? { ...prev, [campo]: undefined } : prev))

  const validate = (): boolean => {
    const errs: FormErrors = {}
    if (!name.trim()) errs.name = 'Dê um nome para reconhecer a conta'
    const parsedAmount = parseNumericInput(amount)
    if (parsedAmount === null || parsedAmount <= 0) errs.amount = 'Informe um valor maior que zero'
    const parsedDay = parseNumericInput(dayOfMonth)
    if (POR_DIA_DO_MES.includes(recurrenceType) && (parsedDay === null || parsedDay < 1 || parsedDay > 31)) {
      errs.recurrence_day_of_month = 'Informe um dia entre 1 e 31'
    }
    if (recurrenceType === 'once' && !dueDate) errs.due_date = 'Escolha a data de vencimento'
    setErrors(errs)

    // Foco no primeiro campo com erro, na ordem em que aparecem na tela.
    const primeiro = (Object.keys(CAMPO_DO_ERRO) as (keyof FormErrors)[]).find((k) => errs[k])
    if (primeiro) {
      const el = document.getElementById(CAMPO_DO_ERRO[primeiro])
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
      el?.focus({ preventScroll: true })
    }
    return !primeiro
  }

  const handleMethodChange = (draftId: string, field: keyof PaymentMethodDraft, value: unknown) => {
    setPaymentMethods((prev) => prev.map((m) => (m.draftId === draftId ? { ...m, [field]: value } : m)))
  }

  // Só um principal: é o que o lembrete mostra primeiro.
  const handlePrimary = (draftId: string) => {
    setPaymentMethods((prev) => prev.map((m) => ({ ...m, is_primary: m.draftId === draftId })))
  }

  const handleAddMethod = (type: 'pix' | 'boleto') => {
    setPaymentMethods((prev) => [...prev, makeDraft(type, prev.length === 0)])
  }

  const handleRemoveMethod = (draftId: string) => {
    setPaymentMethods((prev) => {
      const resto = prev.filter((m) => m.draftId !== draftId)
      // Se saiu o principal, o primeiro que sobrou assume.
      if (resto.length && !resto.some((m) => m.is_primary)) resto[0] = { ...resto[0], is_primary: true }
      return resto
    })
  }

  const salvarMetodos = async (billId: string) => {
    const validos = paymentMethods.filter(preenchido)
    const idsMantidos = new Set(validos.map((m) => m.id).filter(Boolean))
    // Removido, ou esvaziado na edição: apaga.
    const apagar = originalMethods.filter((m) => !idsMantidos.has(m.id))
    // Já salvo e alterado: PATCH. Antes a edição de um método existente era
    // descartada em silêncio — só os novos e os removidos iam para a API.
    const alterar = validos.filter((m) => {
      const original = m.id ? originalMethods.find((o) => o.id === m.id) : undefined
      return original !== undefined && mudou(m, original)
    })
    const criar = validos.filter((m) => !m.id)

    await Promise.all([
      ...apagar.map((m) => billsApi.deletePaymentMethod(billId, m.id)),
      ...alterar.map((m) => billsApi.updatePaymentMethod(billId, m.id!, payloadDoMetodo(m))),
      ...criar.map((m) => billsApi.addPaymentMethod(billId, payloadDoMetodo(m))),
    ])
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        category: category || null,
        description: description.trim() || undefined,
        amount: parseNumericInput(amount) ?? 0,
        is_fixed: isFixed,
        recurrence_type: recurrenceType,
        recurrence_day_of_month: POR_DIA_DO_MES.includes(recurrenceType) ? (parseNumericInput(dayOfMonth) ?? 1) : undefined,
        recurrence_day_of_week: POR_DIA_DA_SEMANA.includes(recurrenceType) ? dayOfWeek : undefined,
        due_date: recurrenceType === 'once' ? dueDate : undefined,
        days_before_alert: daysBeforeAlert,
        is_active: isActive,
      }

      const salva = isEdit && id ? await billsApi.update(id, payload) : await billsApi.create(payload)
      await salvarMetodos(salva.id)

      success(isEdit ? 'Conta atualizada.' : 'Conta criada.')
      navigate('/contas')
    } catch {
      showError('Erro ao salvar conta. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  if (fetchLoading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6" aria-busy="true" aria-label="Carregando conta">
        <div className="h-12 w-56 rounded-xl shimmer-bg" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 rounded-2xl shimmer-bg" />
            ))}
          </div>
          <div className="hidden h-80 rounded-2xl shimmer-bg lg:block" />
        </div>
      </div>
    )
  }

  // Categoria oculta continua na lista se for a da conta, para editar sem trocá-la.
  const opcoesCategoria = categorias.filter((c) => !c.oculta || c.key === category)
  const categoriaAtual = category ? infoCategoria(category, categorias) : null
  const valorNumero = parseNumericInput(amount)
  const metodosOk = paymentMethods.filter(preenchido)
  const lembrete = !isActive
    ? 'Sem lembrete (conta pausada)'
    : daysBeforeAlert === 0
      ? 'Lembrete no dia do vencimento'
      : `Lembrete ${daysBeforeAlert} dia${daysBeforeAlert !== 1 ? 's' : ''} antes`

  const botaoSalvar = (extra: string) => (
    <button
      type="submit"
      disabled={loading}
      className={`btn-primary min-h-[48px] justify-center disabled:cursor-not-allowed disabled:opacity-60 ${extra}`}
    >
      {loading ? (
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-on-primary-fixed border-t-transparent" aria-hidden="true" />
      ) : (
        <span className="material-symbols-outlined text-lg" aria-hidden="true">check</span>
      )}
      {loading ? 'Salvando…' : isEdit ? 'Salvar alterações' : 'Criar conta'}
    </button>
  )

  return (
    <div className="mx-auto max-w-6xl animate-fadeIn">
      {/* Cabeçalho */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          to="/contas"
          aria-label="Voltar para contas"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-on-surface-variant transition-colors hover:bg-surface-container-high hover:text-on-surface"
        >
          <span className="material-symbols-outlined">arrow_back</span>
        </Link>
        <div className="min-w-0">
          <p className="text-xs text-on-surface-variant">Contas</p>
          <h1 className="truncate text-xl font-semibold text-on-surface">{isEdit ? 'Editar conta' : 'Nova conta'}</h1>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          {/* 1. Identificação */}
          <Secao id="secao-conta" icone="receipt_long" titulo="Conta" descricao="Como ela aparece na lista e nos lembretes.">
            <div>
              <label htmlFor="conta-nome" className="label">Nome <span className="text-error">*</span></label>
              <input
                id="conta-nome"
                type="text"
                aria-required="true"
                aria-invalid={!!errors.name}
                aria-describedby={errors.name ? 'conta-nome-erro' : undefined}
                value={name}
                maxLength={100}
                onChange={(e) => {
                  setName(e.target.value)
                  limparErro('name')
                }}
                placeholder="Ex.: Aluguel, Netflix, Energia"
                className={`input-field ${errors.name ? 'error' : ''}`}
              />
              {errors.name && (
                <p id="conta-nome-erro" role="alert" className="mt-1 flex items-center gap-1 text-xs text-error">
                  <span className="material-symbols-outlined text-sm">error</span>
                  {errors.name}
                </p>
              )}
            </div>

            <div>
              <div className="mb-1.5 flex items-baseline justify-between gap-2">
                <p id="conta-categoria" className="label mb-0">Categoria</p>
                <Link to="/gastos" className="text-xs font-medium text-primary hover:underline">
                  Gerenciar em Gastos
                </Link>
              </div>
              <div role="radiogroup" aria-labelledby="conta-categoria" className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
                {opcoesCategoria.map((c) => (
                  <Opcao
                    key={c.key}
                    ativa={category === c.key}
                    // Tocar de novo na escolhida desmarca: categoria é opcional.
                    onClick={() => setCategory(category === c.key ? '' : c.key)}
                    className="justify-start"
                  >
                    <span className="material-symbols-outlined text-lg" aria-hidden="true">{c.icone}</span>
                    <span className="truncate">{c.nome}</span>
                  </Opcao>
                ))}
              </div>
              <p className="mt-1.5 text-xs text-on-surface-variant">
                As mesmas categorias dos gastos, para a análise comparar os dois.
              </p>
            </div>

            {mostrarDescricao ? (
              <div>
                <label htmlFor="conta-descricao" className="label">Observação</label>
                <textarea
                  id="conta-descricao"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex.: débito automático, contrato até março"
                  rows={2}
                  className="input-field resize-y"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarDescricao(true)}
                className="btn-ghost -ml-2 min-h-[44px] px-2 text-primary hover:text-primary"
              >
                <span className="material-symbols-outlined text-lg" aria-hidden="true">add</span>
                Adicionar observação
              </button>
            )}
          </Secao>

          {/* 2. Valor */}
          <Secao id="secao-valor" icone="payments" titulo="Valor">
            <div role="radiogroup" aria-label="Tipo de valor" className="grid grid-cols-2 gap-2">
              {[
                { fixa: true, label: 'Fixa', dica: 'Mesmo valor todo mês' },
                { fixa: false, label: 'Variável', dica: 'Muda a cada mês' },
              ].map((o) => (
                <Opcao key={o.label} ativa={isFixed === o.fixa} onClick={() => setIsFixed(o.fixa)} className="flex-col !gap-0 py-2">
                  <span className="font-semibold">{o.label}</span>
                  <span className="text-[11px] font-normal opacity-80">{o.dica}</span>
                </Opcao>
              ))}
            </div>
            <NumberField
              name="conta-valor"
              label={isFixed ? 'Valor' : 'Valor estimado'}
              hint={isFixed ? undefined : 'Uma média. O valor real de cada mês você informa no card da conta.'}
              required
              mode="currency"
              min={0}
              prefix="R$"
              placeholder="0,00"
              value={amount}
              onChange={(v) => {
                setAmount(v)
                limparErro('amount')
              }}
              error={errors.amount}
            />
          </Secao>

          {/* 3. Vencimento e lembrete */}
          <Secao id="secao-vencimento" icone="event" titulo="Vencimento e lembrete">
            <div>
              <p id="conta-recorrencia" className="label">Repete</p>
              <div role="radiogroup" aria-labelledby="conta-recorrencia" className="grid grid-cols-3 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                {RECORRENCIAS.map((r) => (
                  <Opcao key={r.value} ativa={recurrenceType === r.value} onClick={() => setRecurrenceType(r.value)} className="px-2">
                    {r.label}
                  </Opcao>
                ))}
              </div>
            </div>

            {POR_DIA_DO_MES.includes(recurrenceType) && (
              <NumberField
                name="conta-dia"
                label="Dia do vencimento"
                required
                mode="integer"
                min={1}
                max={31}
                placeholder="10"
                hint="Em mês mais curto, vence no último dia."
                value={dayOfMonth}
                onChange={(v) => {
                  setDayOfMonth(v)
                  limparErro('recurrence_day_of_month')
                }}
                error={errors.recurrence_day_of_month}
                className="sm:max-w-[14rem]"
              />
            )}

            {POR_DIA_DA_SEMANA.includes(recurrenceType) && (
              <div>
                <p id="conta-dia-semana" className="label">Dia da semana</p>
                <div role="radiogroup" aria-labelledby="conta-dia-semana" className="grid grid-cols-7 gap-1.5">
                  {WEEKDAYS.map((day, idx) => (
                    <Opcao key={day} ativa={dayOfWeek === idx} onClick={() => setDayOfWeek(idx)} className="px-0">
                      <span aria-hidden="true">{day}</span>
                      <span className="sr-only">{WEEKDAYS_LONGO[idx]}</span>
                    </Opcao>
                  ))}
                </div>
              </div>
            )}

            {recurrenceType === 'once' && (
              <div className="sm:max-w-[16rem]">
                <label htmlFor="conta-vencimento" className="label">Data de vencimento <span className="text-error">*</span></label>
                <input
                  id="conta-vencimento"
                  type="date"
                  aria-required="true"
                  aria-invalid={!!errors.due_date}
                  aria-describedby={errors.due_date ? 'conta-vencimento-erro' : undefined}
                  value={dueDate}
                  onChange={(e) => {
                    setDueDate(e.target.value)
                    limparErro('due_date')
                  }}
                  className={`input-field ${errors.due_date ? 'error' : ''}`}
                />
                {errors.due_date && (
                  <p id="conta-vencimento-erro" role="alert" className="mt-1 flex items-center gap-1 text-xs text-error">
                    <span className="material-symbols-outlined text-sm">error</span>
                    {errors.due_date}
                  </p>
                )}
              </div>
            )}

            <div className="border-t border-outline-variant/30 pt-5">
              <p id="conta-antecedencia" className="label">Lembrete no WhatsApp</p>
              <div className="flex flex-wrap items-center gap-3">
                <div
                  role="group"
                  aria-labelledby="conta-antecedencia"
                  className="flex items-center rounded-xl border border-outline-variant bg-surface-container"
                >
                  <button
                    type="button"
                    aria-label="Um dia a menos"
                    disabled={daysBeforeAlert <= 0}
                    onClick={() => setDaysBeforeAlert((v) => Math.max(0, v - 1))}
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-l-xl text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-lg">remove</span>
                  </button>
                  <span aria-live="polite" className="w-10 text-center text-base font-semibold tabular-nums text-on-surface">
                    {daysBeforeAlert}
                  </span>
                  <button
                    type="button"
                    aria-label="Um dia a mais"
                    disabled={daysBeforeAlert >= 30}
                    onClick={() => setDaysBeforeAlert((v) => Math.min(30, v + 1))}
                    className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-r-xl text-on-surface transition-colors hover:bg-surface-container-high disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <span className="material-symbols-outlined text-lg">add</span>
                  </button>
                </div>
                <span className="text-sm text-on-surface-variant">
                  {daysBeforeAlert === 0
                    ? 'no próprio dia do vencimento'
                    : `dia${daysBeforeAlert !== 1 ? 's' : ''} antes do vencimento`}
                </span>
              </div>
            </div>
          </Secao>

          {/* 4. Como pagar */}
          <Secao
            id="secao-pagamento"
            icone="account_balance_wallet"
            titulo="Como pagar"
            descricao="Opcional. O lembrete leva a chave ou o código, prontos para copiar."
          >
            {paymentMethods.length === 0 ? (
              <p className="rounded-xl border border-dashed border-outline-variant/60 px-4 py-5 text-center text-sm text-on-surface-variant">
                Nenhuma forma de pagamento.
              </p>
            ) : (
              <div className="space-y-3">
                {paymentMethods.map((method, index) => (
                  <PaymentMethodCard
                    key={method.draftId}
                    method={method}
                    index={index}
                    total={paymentMethods.length}
                    onChange={handleMethodChange}
                    onPrimary={handlePrimary}
                    onRemove={handleRemoveMethod}
                  />
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(['pix', 'boleto'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => handleAddMethod(t)}
                  className="flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-outline-variant/70 text-sm font-medium text-on-surface-variant transition-colors hover:border-primary/60 hover:text-primary"
                >
                  <span className="material-symbols-outlined text-lg" aria-hidden="true">{t === 'pix' ? 'qr_code' : 'barcode'}</span>
                  Adicionar {t === 'pix' ? 'PIX' : 'boleto'}
                </button>
              ))}
            </div>
          </Secao>
        </div>

        {/* Resumo: coluna fixa no desktop; no celular vem depois das seções */}
        <aside className="space-y-4 lg:sticky lg:top-6" aria-label="Resumo da conta">
          <div className="section-card space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="material-symbols-outlined flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-surface-container-high text-2xl text-primary"
                aria-hidden="true"
              >
                {categoriaAtual?.icone ?? getBillIcon(name)}
              </span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-on-surface">{name.trim() || 'Sem nome'}</p>
                <p className="text-xs text-on-surface-variant">{categoriaAtual?.nome ?? 'Sem categoria'}</p>
              </div>
            </div>

            <div>
              <p className="text-2xl font-bold tabular-nums text-on-surface">
                {valorNumero !== null ? formatBRL(valorNumero) : 'R$ —'}
              </p>
              <p className="text-xs text-on-surface-variant">{isFixed ? 'Valor fixo' : 'Estimativa mensal'}</p>
            </div>

            <ul className="space-y-2.5 text-sm text-on-surface">
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-lg text-on-surface-variant" aria-hidden="true">event</span>
                {fraseVencimento(recurrenceType, dayOfMonth, dayOfWeek, dueDate)}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-lg text-on-surface-variant" aria-hidden="true">notifications</span>
                {lembrete}
              </li>
              <li className="flex items-start gap-2">
                <span className="material-symbols-outlined text-lg text-on-surface-variant" aria-hidden="true">account_balance_wallet</span>
                {metodosOk.length === 0
                  ? 'Sem forma de pagamento'
                  : metodosOk.map((m) => (m.type === 'pix' ? 'PIX' : 'Boleto')).join(' · ')}
              </li>
            </ul>

            <div className="border-t border-outline-variant/30 pt-4">
              <Interruptor
                id="conta-ativa"
                ligado={isActive}
                onChange={setIsActive}
                rotulo="Conta ativa"
                descricao={isActive ? 'Gera vencimentos e lembretes' : 'Pausada: não gera lembretes'}
              />
            </div>

            <div className="hidden flex-col gap-2 lg:flex">
              {botaoSalvar('w-full')}
              <Link to="/contas" className="btn-ghost min-h-[44px] justify-center">Cancelar</Link>
            </div>
          </div>
        </aside>

        {/* Ação no celular e tablet: presa acima da barra de navegação, sempre à mão */}
        <div className="sticky bottom-[64px] z-30 -mx-4 flex gap-2 border-t border-outline-variant/40 bg-background/95 px-4 py-3 backdrop-blur md:bottom-0 md:-mx-6 md:px-6 lg:hidden">
          <Link to="/contas" className="btn-ghost min-h-[48px] justify-center">Cancelar</Link>
          {botaoSalvar('flex-1')}
        </div>
      </form>
    </div>
  )
}

export default BillForm
