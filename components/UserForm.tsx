'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Plus, X, UserPlus, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { DailyUser } from '@/lib/types'
import { validateName, validateTitle, validatePhone, validateSendTime, validateChecklist } from '@/lib/validations'
import { validatePhoneWithWAHA } from '@/lib/waha'
import { useDebounce } from '@/lib/hooks'
import LoadingOverlay from './LoadingOverlay'
import SuccessMessage from './SuccessMessage'
import AdminUserFields from './AdminUserFields'
import Button from './ui/Button'
import FormField from './ui/FormField'
import Input from './ui/Input'
import Card from './ui/Card'

interface UserFormProps {
  user?: DailyUser  // Se fornecido, modo edição
  onSuccess?: (userId?: number) => void  // Callback após sucesso
  onCancel?: () => void  // Callback para cancelar (opcional)
  embedded?: boolean  // Se true, opera inline sem navegação
  showAdminFields?: boolean  // Se true, mostra campos administrativos (apenas para admins)
}

export default function UserForm({ user, onSuccess, onCancel, embedded = false, showAdminFields = false }: UserFormProps) {
  const router = useRouter()
  const isEditMode = !!user

  // Converter time_to_send (hora) para sendTime (HH:00)
  const getSendTimeFromHour = (hour: number | null | undefined): string => {
    if (hour !== null && hour !== undefined) {
      return `${String(hour).padStart(2, '0')}:00`
    }
    return ''
  }

  // Parsear option que pode vir como string JSON ou objeto
  const parseOptionToChecklist = (option: unknown): string[] => {
    console.log('📥 Carregando option do banco:', option)
    console.log('📥 Tipo do option:', typeof option)

    if (!option) {
      console.log('⚠️ Option vazio, retornando array vazio')
      return []
    }

    // Se for string, tentar parsear como JSON
    if (typeof option === 'string') {
      try {
        const parsed = JSON.parse(option)
        if (Array.isArray(parsed)) {
          console.log('✅ Checklist parseado com sucesso:', parsed)
          return parsed
        }
        console.log('⚠️ JSON parseado não é array:', parsed)
        return []
      } catch (error) {
        console.error('❌ Erro ao parsear JSON:', error)
        return []
      }
    }

    // Se for objeto com checklist (formato antigo - compatibilidade)
    if (typeof option === 'object' && option !== null && 'checklist' in option && Array.isArray((option as { checklist: unknown }).checklist)) {
      console.log('⚠️ Option em formato objeto antigo, usando checklist:', (option as { checklist: string[] }).checklist)
      return (option as { checklist: string[] }).checklist
    }

    // Se for array diretamente
    if (Array.isArray(option)) {
      console.log('✅ Option já é array:', option)
      return option
    }

    console.log('⚠️ Option em formato desconhecido, retornando vazio')
    return []
  }

  const [name, setName] = useState(user?.name || '')
  const [title, setTitle] = useState(user?.title || '')
  // phone: número para exibição no frontend (sem @c.us)
  // phoneChatId: chatId completo para salvar no backend (com @c.us)
  const [phone, setPhone] = useState(() => {
    // Se user.phone contém @c.us, extrair apenas o número
    const userPhone = user?.phone || ''
    return userPhone.includes('@') ? userPhone.split('@')[0] : userPhone
  })
  const [originalPhone, setOriginalPhone] = useState(() => {
    const userPhone = user?.phone || ''
    return userPhone.includes('@') ? userPhone.split('@')[0] : userPhone
  })
  const [phoneChatId, setPhoneChatId] = useState(user?.phone || '') // Valor original do banco
  const [sendTime, setSendTime] = useState(
    isEditMode ? getSendTimeFromHour(user?.time_to_send) : ''
  )
  const [checklistItems, setChecklistItems] = useState<string[]>(
    isEditMode ? parseOptionToChecklist(user?.option) : []
  )
  const [checklistInput, setChecklistInput] = useState('')

  // Estados de validação
  const [nameError, setNameError] = useState<string | null>(null)
  const [titleError, setTitleError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneValidating, setPhoneValidating] = useState(false)
  const [phoneValidated, setPhoneValidated] = useState(false)
  const [sendTimeError, setSendTimeError] = useState<string | null>(null)
  const [checklistError, setChecklistError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdUserId, setCreatedUserId] = useState<number | undefined>()

  // No modo edição, se o telefone não mudou, considerar como validado
  useEffect(() => {
    if (isEditMode && phone.trim() === originalPhone.trim() && phone.trim() !== '') {
      setPhoneValidated(true)
    }
  }, [isEditMode, phone, originalPhone])

  // Debounce para evitar validações excessivas
  const debouncedName = useDebounce(name, 300)
  const debouncedTitle = useDebounce(title, 300)

  // Validação em tempo real do nome (com debounce)
  useEffect(() => {
    if (debouncedName.trim() === '') {
      setNameError(null)
      return
    }
    const result = validateName(debouncedName)
    setNameError(result.isValid ? null : result.error || null)
  }, [debouncedName])

  // Validação em tempo real do título (com debounce)
  useEffect(() => {
    if (debouncedTitle.trim() === '') {
      setTitleError(null)
      return
    }
    const result = validateTitle(debouncedTitle)
    setTitleError(result.isValid ? null : result.error || null)
  }, [debouncedTitle])

  // Validação em tempo real do telefone (formato básico)
  const [phoneTouched, setPhoneTouched] = useState(false)

  useEffect(() => {
    if (phone.trim() === '') {
      if (phoneTouched) {
        setPhoneError('Telefone é obrigatório')
      } else {
        setPhoneError(null)
      }
      // No modo edição, se telefone não mudou, manter validado
      if (!isEditMode || phone.trim() !== originalPhone.trim()) {
        setPhoneValidated(false)
      }
      return
    }
    const result = validatePhone(phone)
    setPhoneError(result.isValid ? null : result.error || null)
    if (result.isValid) {
      // No modo edição, se telefone não mudou, manter validado
      if (isEditMode && phone.trim() === originalPhone.trim()) {
        setPhoneValidated(true)
      } else {
        setPhoneValidated(false) // Reset validação WAHA quando telefone muda
      }
    }
  }, [phone, phoneTouched, isEditMode, originalPhone])

  // Validação em tempo real da hora
  useEffect(() => {
    if (sendTime.trim() === '') {
      setSendTimeError(null)
      return
    }
    const result = validateSendTime(sendTime)
    setSendTimeError(result.isValid ? null : result.error || null)
  }, [sendTime])

  // Validação do checklist
  const [checklistTouched, setChecklistTouched] = useState(false)

  useEffect(() => {
    if (checklistItems.length === 0) {
      if (checklistTouched) {
        setChecklistError('Checklist é obrigatório. Adicione pelo menos um item.')
      } else {
        setChecklistError(null)
      }
      return
    }
    const result = validateChecklist(checklistItems)
    setChecklistError(result.isValid ? null : result.error || null)
  }, [checklistItems, checklistTouched])

  const addChecklistItem = () => {
    const itemText = checklistInput.trim()
    if (itemText === '') return
    setChecklistItems([...checklistItems, itemText])
    setChecklistInput('')
    setChecklistTouched(true)
  }

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index))
    setChecklistTouched(true)
  }

  const handleChecklistKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      addChecklistItem()
    }
  }

  // Validação WAHA ao perder foco do campo de telefone
  const handlePhoneBlur = async () => {
    const trimmedPhone = phone.trim()
    if (trimmedPhone === '') {
      setPhoneError('Telefone é obrigatório')
      setPhoneValidated(false)
      return
    }

    // No modo edição, se telefone não mudou, não precisa revalidar
    if (isEditMode && trimmedPhone === originalPhone.trim()) {
      setPhoneValidated(true)
      setPhoneError(null)
      return
    }

    // Primeiro valida formato básico
    const basicValidation = validatePhone(trimmedPhone)
    if (!basicValidation.isValid) {
      setPhoneError(basicValidation.error || 'Formato de telefone inválido')
      return
    }

    // Se formato válido, valida com WAHA
    setPhoneValidating(true)
    setPhoneError(null)
    setPhoneValidated(false)

    try {
      const wahaResult = await validatePhoneWithWAHA(trimmedPhone)

      if (wahaResult.isValid && wahaResult.exists) {
        setPhoneValidated(true)
        setPhoneError(null)

        // Atualiza o campo de exibição com o número validado (sem @c.us)
        if (wahaResult.validatedPhone) {
          setPhone(wahaResult.validatedPhone)
          setOriginalPhone(wahaResult.validatedPhone)
        }

        // Armazena o chatId completo para salvar no backend
        if (wahaResult.chatId) {
          setPhoneChatId(wahaResult.chatId)
        }
      } else {
        setPhoneValidated(false)
        setPhoneError(wahaResult.error || 'Número não encontrado no WhatsApp. Verifique se o número está correto. Dica: números brasileiros geralmente precisam do "9" no início (ex: +55 11 99999-9999)')
      }
    } catch {
      setPhoneValidated(false)
      setPhoneError('Erro ao validar telefone. Tente novamente. Dica: números brasileiros geralmente precisam do "9" no início (ex: +55 11 99999-9999)')
    } finally {
      setPhoneValidating(false)
    }
  }

  const resetForm = () => {
    setName('')
    setTitle('')
    setPhone('')
    setOriginalPhone('')
    setSendTime('')
    setChecklistItems([])
    setChecklistInput('')
    setSuccess(false)
    setError(null)
    setCreatedUserId(undefined)
    setNameError(null)
    setTitleError(null)
    setPhoneError(null)
    setPhoneValidated(false)
    setPhoneValidating(false)
    setSendTimeError(null)
    setChecklistError(null)
    setPhoneTouched(false)
    setChecklistTouched(false)
  }

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError(null)

    // Marcar campos obrigatórios como tocados
    setPhoneTouched(true)
    setChecklistTouched(true)

    // Validar todos os campos
    const nameResult = validateName(name)
    const titleResult = validateTitle(title)
    const phoneResult = validatePhone(phone)
    const sendTimeResult = validateSendTime(sendTime)
    const checklistResult = validateChecklist(checklistItems)

    setNameError(nameResult.isValid ? null : nameResult.error || null)
    setTitleError(titleResult.isValid ? null : titleResult.error || null)
    setSendTimeError(sendTimeResult.isValid ? null : sendTimeResult.error || null)
    setChecklistError(checklistResult.isValid ? null : checklistResult.error || null)

    // Telefone é obrigatório - validar formato e WAHA
    if (phone.trim() === '') {
      setPhoneError('Telefone é obrigatório')
      return
    }

    if (!phoneResult.isValid) {
      setPhoneError(phoneResult.error || 'Formato de telefone inválido')
      return
    }

    // Verificar se o telefone foi validado com WAHA
    // No modo edição, se telefone não mudou, considerar validado
    const phoneChanged = isEditMode && phone.trim() !== originalPhone.trim()
    if (!phoneValidated && (phoneChanged || !isEditMode)) {
      setPhoneError('Por favor, saia do campo de telefone para validar o número no WhatsApp')
      return
    }

    // Validar checklist obrigatório
    if (checklistItems.length === 0) {
      setChecklistError('Checklist é obrigatório. Adicione pelo menos um item.')
      return
    }

    // Verificar se há erros
    if (!nameResult.isValid || !titleResult.isValid || !phoneResult.isValid || !sendTimeResult.isValid || !checklistResult.isValid) {
      return
    }

    // Se chegou aqui, pode salvar
    setLoading(true)

    const nameValue = name.trim() || null
    const titleValue = title.trim() || null
    const phoneValue = phone.trim() || null
    const sendTimeValue = sendTime.trim() || null

    // Preparar dados para inserção/atualização no Supabase
    const userData: Record<string, unknown> = {}
    if (nameValue) userData.name = nameValue
    if (titleValue) userData.title = titleValue
    // Salvar o chatId completo (com @c.us) no banco de dados
    if (phoneChatId) {
      userData.phone = phoneChatId
    } else if (phoneValue) {
      // Fallback: se por algum motivo não tiver chatId, usar o número informado
      userData.phone = phoneValue
    }

    // Converter sendTime (HH:mm) para time_to_send (apenas hora)
    if (sendTimeValue) {
      const [hours] = sendTimeValue.split(':').map(Number)
      userData.time_to_send = hours // Salvar apenas a hora
    } else {
      if (isEditMode) {
        userData.time_to_send = null
      }
    }

    // Preparar option como JSON string array
    if (checklistItems.length > 0) {
      // Garantir que todos os items são strings não vazias
      const validItems = checklistItems.filter(item =>
        typeof item === 'string' && item.trim().length > 0
      )

      if (validItems.length > 0) {
        userData.option = JSON.stringify(validItems)
        console.log('✅ Salvando checklist:', validItems)
        console.log('📦 JSON stringificado:', userData.option)
      } else {
        // Se após filtrar não sobrou nenhum item válido
        if (isEditMode) {
          userData.option = null
        }
      }
    } else {
      if (isEditMode) {
        userData.option = null
      }
    }

    try {
      if (isEditMode) {
        // Modo edição: atualizar via API protegida
        const response = await fetch(`/api/users/${user.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao atualizar usuário')
        }

        setSuccess(true)
        setLoading(false)

        // Callback de sucesso
        if (onSuccess) {
          onSuccess(user.id)
        } else if (!embedded) {
          // Redirecionar para lista de usuários após 1 segundo (apenas se não embedded)
          setTimeout(() => {
            router.push('/users')
          }, 1000)
        }
      } else {
        // Modo criação: inserir via API protegida
        const response = await fetch('/api/users', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(userData),
        })

        const result = await response.json()

        if (!response.ok) {
          throw new Error(result.error || 'Erro ao criar usuário')
        }

        setCreatedUserId(result.user?.id || result.id)
        setSuccess(true)
        setLoading(false)

        // Callback de sucesso
        if (onSuccess) {
          onSuccess(result.user?.id || result.id)
        }
      }
    } catch (err: unknown) {
      console.error(`Erro ao ${isEditMode ? 'atualizar' : 'criar'} usuário:`, err)
      setError(err instanceof Error ? err.message : `Ocorreu um erro ao ${isEditMode ? 'atualizar' : 'cadastrar'} o usuário. Tente novamente.`)
      setLoading(false)
    }
  }

  const handleCancel = () => {
    if (onCancel) {
      onCancel()
    } else if (!embedded) {
      if (isEditMode) {
        router.push('/users')
      } else {
        router.push('/')
      }
    }
  }

  return (
    <>
      {success && (
        <SuccessMessage
          userId={isEditMode ? user?.id : createdUserId}
          onReset={isEditMode ? undefined : resetForm}
          mode={isEditMode ? 'edit' : 'create'}
        />
      )}

      {error && (
        <Card className="mb-6 border-red-100">
          <div className="flex items-start gap-4">
            <div className="bg-red-50 p-3 rounded-lg">
              <AlertCircle className="text-red-600 w-6 h-6" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-red-900 mb-1">
                Erro ao {isEditMode ? 'atualizar' : 'criar'} usuário
              </h3>
              <p className="text-sm text-red-700">{error}</p>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="mb-4 pb-4 border-b border-slate-800">
            <p className="text-sm text-slate-400">
              Campos marcados com <span className="text-red-500">*</span> são obrigatórios
            </p>
          </div>

          {/* Nome */}
          <FormField
            label="Nome"
            optional
            error={nameError}
          >
            <Input
              type="text"
              id="name"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={!!nameError}
              placeholder="Ex: João Silva"
              className="bg-slate-950/50 border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder:text-slate-600"
            />
          </FormField>

          {/* Telefone */}
          <FormField
            label="Telefone"
            required
            error={phoneError}
            helperText={
              phoneValidated && phone.trim() !== '' && !phoneError
                ? 'Telefone válido no WhatsApp'
                : !phoneError && !phoneValidated && phone.trim() !== ''
                  ? 'O telefone será validado automaticamente ao sair do campo'
                  : undefined
            }
          >
            <Input
              type="text"
              id="phone"
              name="phone"
              value={phone}
              onChange={(e) => {
                setPhone(e.target.value)
                setPhoneTouched(true)
              }}
              onBlur={handlePhoneBlur}
              error={!!phoneError}
              validated={phoneValidated && !phoneError}
              validating={phoneValidating}
              placeholder="Ex: +55 11 99999-9999"
              className="bg-slate-950/50 border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500 text-white placeholder:text-slate-600"
            />
            {phoneValidated && phone.trim() !== '' && !phoneError && (
              <p className="mt-1 text-sm text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Telefone válido no WhatsApp
              </p>
            )}
          </FormField>

          {/* Hora do Envio */}
          <FormField
            label="Hora do Envio"
            optional
            error={sendTimeError}
          >
            <select
              id="sendTime"
              name="sendTime"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className={`w-full px-4 py-2.5 rounded-lg border ${sendTimeError ? 'border-red-500 focus:ring-red-500' : 'border-slate-700 focus:ring-emerald-500/50 focus:border-emerald-500'} focus:outline-none focus:ring-2 bg-slate-950/50 text-white`}
            >
              <option value="" className="bg-slate-900 text-slate-500">Selecione a hora</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`} className="bg-slate-900">
                  {String(i).padStart(2, '0')}h
                </option>
              ))}
            </select>
          </FormField>

          {/* ========== SEÇÃO WHATSAPP POLL ========== */}
          <div className="mt-8">
            {/* Header da seção */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-600 to-teal-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-500/10 border border-emerald-500/20">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Configurar Enquete WhatsApp</h3>
                <p className="text-xs text-slate-400">Pré-visualize como ficará a enquete enviada</p>
              </div>
            </div>

            {/* WhatsApp Poll Preview Container */}
            <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-4 shadow-xl border border-slate-700">

              {/* Poll Header - Título */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Pergunta da enquete</span>
                  {titleError && <span className="text-xs text-red-400">• {titleError}</span>}
                </div>
                <input
                  type="text"
                  id="title"
                  name="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`w-full bg-slate-700/50 border ${titleError ? 'border-red-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-white text-lg font-medium placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all`}
                  placeholder={`Ex: Como foi o dia ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`}
                />
              </div>

              {/* Poll Instruction */}
              <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm">
                <span className="text-lg">📊</span>
                <span>Selecione uma ou mais opções</span>
              </div>

              {/* Poll Options - Checklist Items */}
              <div className="space-y-2 mb-4">
                {checklistItems.map((item, index) => (
                  <div
                    key={index}
                    className="group relative bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      {/* Checkbox estilo WhatsApp */}
                      <div className="w-6 h-6 rounded-full border-2 border-green-500 bg-green-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>

                      {/* Option Text */}
                      <span className="flex-1 text-white text-sm font-medium">{item}</span>

                      {/* Remove button */}
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(index)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add new option */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">
                    Adicionar opção <span className="text-red-400">*</span>
                  </span>
                  {checklistError && <span className="text-xs text-red-400">• {checklistError}</span>}
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <input
                      type="text"
                      value={checklistInput}
                      onChange={(e) => setChecklistInput(e.target.value)}
                      onKeyPress={handleChecklistKeyPress}
                      className={`w-full bg-slate-700/50 border ${checklistError && checklistItems.length === 0 ? 'border-red-500' : 'border-slate-600'} rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all pr-10`}
                      placeholder="Ex: 🏋️ Foi pra academia"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">📝</span>
                  </div>
                  <button
                    type="button"
                    onClick={addChecklistItem}
                    disabled={checklistInput.trim() === ''}
                    className="px-4 py-3 bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg hover:shadow-green-500/25 disabled:shadow-none"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Empty State */}
              {checklistItems.length === 0 && (
                <div className={`p-6 rounded-xl border-2 border-dashed ${checklistError ? 'border-red-500/50 bg-red-500/10' : 'border-slate-600 bg-slate-800/50'} text-center`}>
                  <span className="text-4xl mb-3 block">📋</span>
                  <p className={`text-sm ${checklistError ? 'text-red-400' : 'text-slate-400'}`}>
                    {checklistError || 'Adicione opções para sua enquete do WhatsApp'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Use emojis para deixar mais visual! Ex: 🏃 Treinou hoje
                  </p>
                </div>
              )}

              {/* Poll Footer */}
              {checklistItems.length > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-xs text-slate-500">
                    {checklistItems.length} opç{checklistItems.length === 1 ? 'ão' : 'ões'} configurada{checklistItems.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-green-400 font-medium">
                    ✓ Pronto para enviar
                  </span>
                </div>
              )}
            </div>

            {/* Debug/Preview do JSON em modo desenvolvimento */}
            {checklistItems.length > 0 && process.env.NODE_ENV === 'development' && (
              <div className="mt-4 p-4 bg-slate-100 rounded-lg border border-slate-300">
                <p className="text-xs font-semibold text-slate-700 mb-2">🔍 Preview - Formato no Banco de Dados:</p>
                <pre className="text-xs font-mono text-slate-600 bg-white p-3 rounded border border-slate-200 overflow-x-auto">
                  {JSON.stringify(checklistItems, null, 2)}
                </pre>
                <p className="text-xs text-slate-500 mt-2">
                  ✅ Será salvo como string JSON: <code className="bg-white px-1 py-0.5 rounded">{JSON.stringify(checklistItems)}</code>
                </p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-6 border-t border-slate-800">
            <Button
              type="submit"
              disabled={loading || phoneValidating}
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
              icon={isEditMode ? Save : UserPlus}
            >
              {loading
                ? (isEditMode ? 'Salvando...' : 'Criando...')
                : (isEditMode ? 'Salvar Alterações' : 'Criar Usuário')
              }
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
              disabled={loading}
              className="border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>

      {/* Campos Administrativos - Apenas para Admins */}
      {showAdminFields && isEditMode && user && (
        <AdminUserFields
          userId={user.id}
          currentIsAdmin={user.is_admin}
          currentSubscriptionStatus={user.subscription_status}
          currentTrialEndsAt={user.trial_ends_at}
          onSuccess={() => {
            // Callback quando alguma operação admin for bem-sucedida
            if (onSuccess) {
              onSuccess(user.id)
            }
          }}
        />
      )}

      {loading && (
        <LoadingOverlay message={isEditMode ? 'Salvando alterações...' : 'Criando usuário...'} />
      )}
    </>
  )
}
