'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Plus, X, UserPlus, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { validateName, validateTitle, validatePhone, validateSendTime, validateChecklist } from '@/lib/validations'
import { validatePhoneWithWAHA } from '@/lib/waha'
import { cn } from '@/lib/utils'
import Spinner from './ui/Spinner'
import Alert from './ui/Alert'
import Button from './ui/Button'
import FormField from './ui/FormField'
import Input from './ui/Input'
import Card from './ui/Card'

export default function CreateUserForm() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [title, setTitle] = useState('')
  const [phone, setPhone] = useState('')
  const [phoneChatId, setPhoneChatId] = useState('')
  const [sendTime, setSendTime] = useState('')
  const [checklistItems, setChecklistItems] = useState<string[]>([])
  const [checklistInput, setChecklistInput] = useState('')

  // Estados de validação
  const [nameError, setNameError] = useState<string | null>(null)
  const [phoneError, setPhoneError] = useState<string | null>(null)
  const [phoneValidating, setPhoneValidating] = useState(false)
  const [phoneValidated, setPhoneValidated] = useState(false)
  const [sendTimeError, setSendTimeError] = useState<string | null>(null)
  const [checklistError, setChecklistError] = useState<string | null>(null)

  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [createdUserId, setCreatedUserId] = useState<number | undefined>()

  // Validação em tempo real do nome
  useEffect(() => {
    if (name.trim() === '') {
      setNameError(null)
      return
    }
    const result = validateName(name)
    setNameError(result.isValid ? null : result.error || null)
  }, [name])

  // Validação em tempo real do telefone
  const [phoneTouched, setPhoneTouched] = useState(false)

  useEffect(() => {
    if (phone.trim() === '') {
      if (phoneTouched) {
        setPhoneError('Telefone é obrigatório')
      } else {
        setPhoneError(null)
      }
      setPhoneValidated(false)
      return
    }
    const result = validatePhone(phone)
    setPhoneError(result.isValid ? null : result.error || null)
    if (result.isValid) {
      setPhoneValidated(false)
    }
  }, [phone, phoneTouched])

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

  const handlePhoneBlur = async () => {
    const trimmedPhone = phone.trim()
    if (trimmedPhone === '') {
      setPhoneError('Telefone é obrigatório')
      setPhoneValidated(false)
      return
    }

    const basicValidation = validatePhone(trimmedPhone)
    if (!basicValidation.isValid) {
      setPhoneError(basicValidation.error || 'Formato de telefone inválido')
      return
    }

    setPhoneValidating(true)
    setPhoneError(null)
    setPhoneValidated(false)

    try {
      const wahaResult = await validatePhoneWithWAHA(trimmedPhone)

      if (wahaResult.isValid && wahaResult.exists) {
        setPhoneValidated(true)
        setPhoneError(null)

        if (wahaResult.validatedPhone) {
          setPhone(wahaResult.validatedPhone)
        }

        if (wahaResult.chatId) {
          setPhoneChatId(wahaResult.chatId)
        }
      } else {
        setPhoneValidated(false)
        setPhoneError(wahaResult.error || 'Número não encontrado no WhatsApp')
      }
    } catch {
      setPhoneValidated(false)
      setPhoneError('Erro ao validar telefone. Tente novamente.')
    } finally {
      setPhoneValidating(false)
    }
  }

  const resetForm = () => {
    setName('')
    setTitle('')
    setPhone('')
    setPhoneChatId('')
    setSendTime('')
    setChecklistItems([])
    setChecklistInput('')
    setSuccess(false)
    setError(null)
    setCreatedUserId(undefined)
    setNameError(null)
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

    setPhoneTouched(true)
    setChecklistTouched(true)

    const nameResult = validateName(name)
    const titleResult = validateTitle(title)
    const phoneResult = validatePhone(phone)
    const sendTimeResult = validateSendTime(sendTime)
    const checklistResult = validateChecklist(checklistItems)

    setNameError(nameResult.isValid ? null : nameResult.error || null)
    setSendTimeError(sendTimeResult.isValid ? null : sendTimeResult.error || null)
    setChecklistError(checklistResult.isValid ? null : checklistResult.error || null)

    if (phone.trim() === '') {
      setPhoneError('Telefone é obrigatório')
      return
    }

    if (!phoneResult.isValid) {
      setPhoneError(phoneResult.error || 'Formato de telefone inválido')
      return
    }

    if (!phoneValidated) {
      setPhoneError('Por favor, saia do campo de telefone para validar o número no WhatsApp')
      return
    }

    if (checklistItems.length === 0) {
      setChecklistError('Checklist é obrigatório. Adicione pelo menos um item.')
      return
    }

    if (!nameResult.isValid || !titleResult.isValid || !phoneResult.isValid || !sendTimeResult.isValid || !checklistResult.isValid) {
      return
    }

    setLoading(true)

    const nameValue = name.trim() || null
    const titleValue = title.trim() || null
    const phoneValue = phone.trim() || null
    const sendTimeValue = sendTime.trim() || null

    const userData: Record<string, unknown> = {}
    if (nameValue) userData.name = nameValue
    if (titleValue) userData.title = titleValue
    if (phoneChatId) {
      userData.phone = phoneChatId
    } else if (phoneValue) {
      userData.phone = phoneValue
    }

    if (sendTimeValue) {
      const [hours] = sendTimeValue.split(':').map(Number)
      userData.time_to_send = hours
    }

    if (checklistItems.length > 0) {
      const validItems = checklistItems.filter(item =>
        typeof item === 'string' && item.trim().length > 0
      )

      if (validItems.length > 0) {
        userData.option = JSON.stringify(validItems)
      }
    }

    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      })

      const result = await response.json()

      if (!response.ok) throw new Error(result.error || 'Erro ao criar usuário')

      setCreatedUserId(result.user?.id || result.id)
      setSuccess(true)
      setLoading(false)
    } catch (err: unknown) {
      console.error('Erro ao criar usuário:', err)
      setError(err instanceof Error ? err.message : 'Ocorreu um erro ao cadastrar o usuário. Tente novamente.')
      setLoading(false)
    }
  }

  // Success state
  if (success) {
    return (
      <Alert variant="success" title="Usuário criado com sucesso!" className="mb-6"
        action={
          <div className="flex gap-3 mt-2">
            {createdUserId && (
              <Link href={`/?id=${createdUserId}`}>
                <Button size="sm">Ver Dashboard</Button>
              </Link>
            )}
            <Button size="sm" variant="secondary" onClick={resetForm}>
              Criar Outro
            </Button>
          </div>
        }
      >
        O usuário foi cadastrado no sistema.
      </Alert>
    )
  }

  return (
    <>
      {error && (
        <Alert variant="error" title="Erro ao criar usuário" className="mb-6" onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Card>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="mb-4 pb-4 border-b border-slate-800">
            <p className="text-sm text-slate-400">
              Campos marcados com <span className="text-red-400">*</span> são obrigatórios
            </p>
          </div>

          <FormField label="Nome" optional error={nameError}>
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
              <p className="mt-1 text-sm text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                Telefone válido no WhatsApp
              </p>
            )}
          </FormField>

          <FormField label="Hora do Envio" optional error={sendTimeError}>
            <select
              id="sendTime"
              name="sendTime"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className={cn(
                'w-full px-4 py-3 bg-slate-950/50 border rounded-lg focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-slate-100',
                sendTimeError ? 'border-red-500/50 bg-red-500/5 focus:ring-red-500/50' : 'border-slate-800'
              )}
            >
              <option value="">Selecione a hora</option>
              {Array.from({ length: 24 }, (_, i) => (
                <option key={i} value={`${String(i).padStart(2, '0')}:00`}>
                  {String(i).padStart(2, '0')}h
                </option>
              ))}
            </select>
          </FormField>

          {/* WhatsApp Poll Section */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center shadow-md">
                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-100">Configurar Enquete WhatsApp</h3>
                <p className="text-xs text-slate-500">Configure as opções da enquete diária</p>
              </div>
            </div>

            <div className="bg-gradient-to-b from-slate-800 to-slate-900 rounded-2xl p-4 shadow-xl border border-slate-700">
              <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm">
                <span className="text-lg">📊</span>
                <span>Como foi seu dia - Opções da enquete</span>
              </div>

              <div className="space-y-2 mb-4">
                {checklistItems.map((item, index) => (
                  <div
                    key={index}
                    className="group relative bg-slate-700/40 hover:bg-slate-700/60 border border-slate-600 rounded-xl px-4 py-3 transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-6 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center flex-shrink-0">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="flex-1 text-white text-sm font-medium">{item}</span>
                      <span className="text-slate-400 text-xs mr-2">1</span>
                      <button
                        type="button"
                        onClick={() => removeChecklistItem(index)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/80 hover:bg-red-500 rounded-lg transition-all"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                    </div>
                    <div className="mt-2 h-1.5 bg-slate-600 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-emerald-400 to-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(20, Math.random() * 80 + 20)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

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
                      className={cn(
                        'w-full bg-slate-700/50 border rounded-xl px-4 py-3 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all pr-10',
                        checklistError && checklistItems.length === 0 ? 'border-red-500' : 'border-slate-600'
                      )}
                      placeholder="Ex: 🏋️ Foi pra academia"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">📝</span>
                  </div>
                  <button
                    type="button"
                    onClick={addChecklistItem}
                    disabled={checklistInput.trim() === ''}
                    className="px-4 py-3 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-slate-600 disabled:to-slate-700 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg hover:shadow-emerald-500/25 disabled:shadow-none"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {checklistItems.length === 0 && (
                <div className={cn(
                  'p-6 rounded-xl border-2 border-dashed text-center',
                  checklistError ? 'border-red-500/50 bg-red-500/10' : 'border-slate-600 bg-slate-800/50'
                )}>
                  <span className="text-4xl mb-3 block">📋</span>
                  <p className={cn('text-sm', checklistError ? 'text-red-400' : 'text-slate-400')}>
                    {checklistError || 'Adicione opções para sua enquete do WhatsApp'}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    Use emojis para deixar mais visual! Ex: 🏃 Treinou hoje
                  </p>
                </div>
              )}

              {checklistItems.length > 0 && (
                <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                  <span className="text-xs text-slate-500">
                    {checklistItems.length} opç{checklistItems.length === 1 ? 'ão' : 'ões'} configurada{checklistItems.length === 1 ? '' : 's'}
                  </span>
                  <span className="text-xs text-emerald-400 font-medium">
                    ✓ Pronto para enviar
                  </span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-start gap-2 text-xs text-slate-500">
              <span className="text-amber-500">💡</span>
              <p>
                <strong>Dica:</strong> Use emojis no início de cada opção para tornar a enquete mais visual e engajante!
              </p>
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-slate-800">
            <Button
              type="submit"
              disabled={loading || phoneValidating}
              loading={loading}
              className="flex-1"
              icon={UserPlus}
            >
              Criar Usuário
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => router.push('/')}
              disabled={loading}
            >
              Cancelar
            </Button>
          </div>
        </form>
      </Card>

      {loading && <Spinner variant="overlay" message="Criando usuário..." />}
    </>
  )
}
