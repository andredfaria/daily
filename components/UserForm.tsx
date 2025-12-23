'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Plus, X, UserPlus, Save, AlertCircle, CheckCircle2 } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'
import { validateName, validateTitle, validatePhone, validateSendTime, validateChecklist } from '@/lib/validations'
import { validatePhoneWithWAHA } from '@/lib/waha'
import LoadingOverlay from './LoadingOverlay'
import SuccessMessage from './SuccessMessage'
import Button from './ui/Button'
import FormField from './ui/FormField'
import Input from './ui/Input'
import Card from './ui/Card'

interface UserFormProps {
  user?: DailyUser  // Se fornecido, modo edição
  onSuccess?: (userId?: number) => void  // Callback após sucesso
  onCancel?: () => void  // Callback para cancelar (opcional)
  embedded?: boolean  // Se true, opera inline sem navegação
}

export default function UserForm({ user, onSuccess, onCancel, embedded = false }: UserFormProps) {
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
  const parseOptionToChecklist = (option: any): string[] => {
    if (!option) return []
    // Se for string, tentar parsear como JSON
    if (typeof option === 'string') {
      try {
        const parsed = JSON.parse(option)
        return Array.isArray(parsed) ? parsed : []
      } catch {
        return []
      }
    }
    // Se for objeto com checklist
    if (option.checklist && Array.isArray(option.checklist)) {
      return option.checklist
    }
    // Se for array diretamente
    if (Array.isArray(option)) {
      return option
    }
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

  // Validação em tempo real do nome
  useEffect(() => {
    if (name.trim() === '') {
      setNameError(null)
      return
    }
    const result = validateName(name)
    setNameError(result.isValid ? null : result.error || null)
  }, [name])

  // Validação em tempo real do título
  useEffect(() => {
    if (title.trim() === '') {
      setTitleError(null)
      return
    }
    const result = validateTitle(title)
    setTitleError(result.isValid ? null : result.error || null)
  }, [title])

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
    } catch (err: any) {
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
    const userData: any = {}
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
      userData.option = JSON.stringify(checklistItems)
    } else {
      if (isEditMode) {
        userData.option = null
      }
    }

    try {
      if (isEditMode) {
        // Modo edição: atualizar
        const { error: updateError } = await supabase
          .from('daily_user')
          .update(userData)
          .eq('id', user.id)

        if (updateError) throw updateError

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
        // Modo criação: inserir
        const { data, error: insertError } = await supabase
          .from('daily_user')
          .insert([userData])
          .select()
          .single()

        if (insertError) throw insertError

        setCreatedUserId(data.id)
        setSuccess(true)
        setLoading(false)

        // Callback de sucesso
        if (onSuccess) {
          onSuccess(data.id)
        }
      }
    } catch (err: any) {
      console.error(`Erro ao ${isEditMode ? 'atualizar' : 'criar'} usuário:`, err)
      setError(err.message || `Ocorreu um erro ao ${isEditMode ? 'atualizar' : 'cadastrar'} o usuário. Tente novamente.`)
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
          <div className="mb-4 pb-4 border-b border-slate-200">
            <p className="text-sm text-slate-500">
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
            />
            {phoneValidated && phone.trim() !== '' && !phoneError && (
              <p className="mt-1 text-sm text-green-600 flex items-center gap-1">
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
            <Input
              type="time"
              id="sendTime"
              name="sendTime"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              error={!!sendTimeError}
            />
          </FormField>

          <hr></hr>
          <div className="mb-4 pb-4 border-b border-slate-200">
            <p className="text-sm text-slate-500">
              Campos do envio no whatsapp
            </p>
          </div>


          {/* Título */}
          <FormField
            label="Título"
            optional
            error={titleError}
          >
            <Input
              type="text"
              id="title"
              name="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              error={!!titleError}
              placeholder="Ex: Como foi seu dia"
            />
          </FormField>

          {/* Checklist */}
          <FormField
            label="Checklist"
            required
            error={checklistError}
          >
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={checklistInput}
                  onChange={(e) => setChecklistInput(e.target.value)}
                  onKeyPress={handleChecklistKeyPress}
                  error={!!(checklistError && checklistItems.length === 0)}
                  placeholder="Digite um item do checklist"
                  className="flex-1"
                />
                <Button
                  type="button"
                  onClick={addChecklistItem}
                  disabled={checklistInput.trim() === ''}
                  size="md"
                  className="px-4 py-3"
                >
                  <Plus className="w-5 h-5" />
                </Button>
              </div>
              {checklistItems.length === 0 ? (
                <div className={`p-4 rounded-lg border ${checklistError
                  ? 'bg-red-50 border-red-200'
                  : 'bg-slate-50 border-slate-200'
                  }`}>
                  <p className={`text-sm ${checklistError ? 'text-red-600' : 'text-slate-500'
                    }`}>
                    {checklistError || 'Nenhum item adicionado. Adicione pelo menos um item ao checklist.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {checklistItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 bg-slate-50 px-4 py-2 rounded-lg border border-slate-200"
                    >
                      <span className="flex-1 text-sm text-slate-700">{item}</span>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(index)}
                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              {checklistError && checklistItems.length > 0 && (
                <p className="text-sm text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {checklistError}
                </p>
              )}
            </div>
          </FormField>

          {/* Actions */}
          <div className="flex gap-3 pt-4 border-t border-slate-200">
            <Button
              type="submit"
              disabled={loading || phoneValidating}
              className="flex-1"
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
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>

      {loading && (
        <LoadingOverlay message={isEditMode ? 'Salvando alterações...' : 'Criando usuário...'} />
      )}
    </>
  )
}
