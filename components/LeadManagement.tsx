'use client'

import { useState, useEffect, FormEvent } from 'react'
import { Plus, X, UserPlus, Save, AlertCircle, CheckCircle2, Edit, Users, Clock, Trash2, ExternalLink } from 'lucide-react'

import { DailyUser } from '@/lib/types'
import { validateName, validateTitle, validatePhone, validateSendTime, validateChecklist } from '@/lib/validations'
import { validatePhoneWithWAHA } from '@/lib/waha'
import { useAuth } from './AuthProvider'
import LoadingOverlay from './LoadingOverlay'
import LoadingSpinner from './LoadingSpinner'
import Button from './ui/Button'
import FormField from './ui/FormField'
import Input from './ui/Input'
import Card from './ui/Card'

export default function LeadManagement() {
    // ===== CONTROLE DE ACESSO =====
    const { isAdmin, canEdit } = useAuth()

    // ===== LISTAGEM DE USUARIO =====
    const [users, setUsers] = useState<DailyUser[]>([])
    const [loadingUsers, setLoadingUsers] = useState(true)
    const [selectedUser, setSelectedUser] = useState<DailyUser | null>(null)

    // ===== FORMULÁRIO =====
    const [name, setName] = useState('')
    const [title, setTitle] = useState('')
    const [phone, setPhone] = useState('')
    const [phoneChatId, setPhoneChatId] = useState('')
    const [originalPhone, setOriginalPhone] = useState('')
    const [sendTime, setSendTime] = useState('')
    const [checklistItems, setChecklistItems] = useState<string[]>([])
    const [checklistInput, setChecklistInput] = useState('')

    // Estados de validação
    const [nameError, setNameError] = useState<string | null>(null)
    const [titleError, setTitleError] = useState<string | null>(null)
    const [phoneError, setPhoneError] = useState<string | null>(null)
    const [phoneValidating, setPhoneValidating] = useState(false)
    const [phoneValidated, setPhoneValidated] = useState(false)
    const [sendTimeError, setSendTimeError] = useState<string | null>(null)
    const [checklistError, setChecklistError] = useState<string | null>(null)
    const [phoneTouched, setPhoneTouched] = useState(false)
    const [checklistTouched, setChecklistTouched] = useState(false)

    const [loading, setLoading] = useState(false)
    const [success, setSuccess] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const isEditMode = !!selectedUser

    // ===== CARREGAR USUÁRIOS =====
    const loadUsers = async () => {
        try {
            setLoadingUsers(true)
            const response = await fetch('/api/users?limit=100&orderBy=created_at&orderDirection=desc')
            const data = await response.json()

            if (!response.ok) throw new Error(data.error || 'Erro ao carregar usuários')
            setUsers(data.users || data || [])
        } catch (err: unknown) {
            console.error('Erro ao carregar usuários:', err)
        } finally {
            setLoadingUsers(false)
        }
    }

    useEffect(() => {
        loadUsers()
    }, [])

    // ===== HELPERS =====
    const getSendTimeFromHour = (hour: number | null | undefined): string => {
        if (hour !== null && hour !== undefined) {
            return `${String(hour).padStart(2, '0')}:00`
        }
        return ''
    }

    const parseOptionToChecklist = (option: unknown): string[] => {
        if (!option) return []
        if (typeof option === 'string') {
            try {
                const parsed = JSON.parse(option)
                return Array.isArray(parsed) ? parsed : []
            } catch {
                return []
            }
        }
        if (typeof option === 'object' && option !== null && 'checklist' in option && Array.isArray((option as { checklist: unknown }).checklist)) {
            return (option as { checklist: string[] }).checklist
        }
        if (Array.isArray(option)) {
            return option
        }
        return []
    }

    const formatPhone = (phone: string | null): string => {
        if (!phone) return ''
        return phone.replace('@c.us', '')
    }

    // ===== SELECIONAR USUÁRIO PARA EDIÇÃO =====
    const selectUser = (user: DailyUser) => {
        setSelectedUser(user)
        setName(user.name || '')
        setTitle(user.title || '')
        const userPhone = user.phone || ''
        const displayPhone = userPhone.includes('@') ? userPhone.split('@')[0] : userPhone
        setPhone(displayPhone)
        setOriginalPhone(displayPhone)
        setPhoneChatId(user.phone || '')
        setSendTime(getSendTimeFromHour(user.time_to_send))
        setChecklistItems(parseOptionToChecklist(user.option))
        setChecklistInput('')
        setSuccess(false)
        setError(null)
        setPhoneValidated(true) // No modo edição, telefone existente é considerado validado
        setPhoneTouched(false)
        setChecklistTouched(false)
        setNameError(null)
        setTitleError(null)
        setPhoneError(null)
        setSendTimeError(null)
        setChecklistError(null)
    }

    // ===== NOVO LEAD =====
    const newLead = () => {
        setSelectedUser(null)
        resetForm()
    }

    // ===== RESET FORM =====
    const resetForm = () => {
        setName('')
        setTitle('')
        setPhone('')
        setPhoneChatId('')
        setOriginalPhone('')
        setSendTime('')
        setChecklistItems([])
        setChecklistInput('')
        setSuccess(false)
        setError(null)
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

    // ===== VALIDAÇÕES EM TEMPO REAL =====
    useEffect(() => {
        if (name.trim() === '') {
            setNameError(null)
            return
        }
        const result = validateName(name)
        setNameError(result.isValid ? null : result.error || null)
    }, [name])

    useEffect(() => {
        if (title.trim() === '') {
            setTitleError(null)
            return
        }
        const result = validateTitle(title)
        setTitleError(result.isValid ? null : result.error || null)
    }, [title])

    useEffect(() => {
        if (phone.trim() === '') {
            if (phoneTouched) {
                setPhoneError('Telefone é obrigatório')
            } else {
                setPhoneError(null)
            }
            if (!isEditMode || phone.trim() !== originalPhone.trim()) {
                setPhoneValidated(false)
            }
            return
        }
        const result = validatePhone(phone)
        setPhoneError(result.isValid ? null : result.error || null)
        if (result.isValid) {
            if (isEditMode && phone.trim() === originalPhone.trim()) {
                setPhoneValidated(true)
            } else {
                setPhoneValidated(false)
            }
        }
    }, [phone, phoneTouched, isEditMode, originalPhone])

    useEffect(() => {
        if (sendTime.trim() === '') {
            setSendTimeError(null)
            return
        }
        const result = validateSendTime(sendTime)
        setSendTimeError(result.isValid ? null : result.error || null)
    }, [sendTime])

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

    // ===== CHECKLIST FUNÇÕES =====
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

    // ===== VALIDAÇÃO WAHA =====
    const handlePhoneBlur = async () => {
        const trimmedPhone = phone.trim()
        if (trimmedPhone === '') {
            setPhoneError('Telefone é obrigatório')
            setPhoneValidated(false)
            return
        }

        if (isEditMode && trimmedPhone === originalPhone.trim()) {
            setPhoneValidated(true)
            setPhoneError(null)
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
                    setOriginalPhone(wahaResult.validatedPhone)
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

    // ===== SUBMIT =====
    const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        setError(null)

        // Validação de permissões
        if (!isEditMode && !isAdmin()) {
            setError('Apenas administradores podem criar usuários')
            return
        }

        if (isEditMode && selectedUser && !canEdit(selectedUser.id)) {
            setError('Você não tem permissão para editar este usuário')
            return
        }

        setPhoneTouched(true)
        setChecklistTouched(true)

        const nameResult = validateName(name)
        const titleResult = validateTitle(title)
        const phoneResult = validatePhone(phone)
        const sendTimeResult = validateSendTime(sendTime)
        const checklistResult = validateChecklist(checklistItems)

        setNameError(nameResult.isValid ? null : nameResult.error || null)
        setTitleError(titleResult.isValid ? null : titleResult.error || null)
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

        const phoneChanged = isEditMode && phone.trim() !== originalPhone.trim()
        if (!phoneValidated && (phoneChanged || !isEditMode)) {
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
        const sendTimeValue = sendTime.trim() || null

        const userData: Record<string, unknown> = {}
        if (nameValue) userData.name = nameValue
        if (titleValue) userData.title = titleValue
        if (phoneChatId) {
            userData.phone = phoneChatId
        } else if (phone.trim()) {
            userData.phone = phone.trim()
        }

        if (sendTimeValue) {
            const [hours] = sendTimeValue.split(':').map(Number)
            userData.time_to_send = hours
        } else if (isEditMode) {
            userData.time_to_send = null
        }

        if (checklistItems.length > 0) {
            // Garantir que todos os items são strings não vazias
            const validItems = checklistItems.filter(item =>
                typeof item === 'string' && item.trim().length > 0
            )

            if (validItems.length > 0) {
                userData.option = JSON.stringify(validItems)
                console.log('✅ Salvando checklist:', validItems)
                console.log('📦 JSON stringificado:', userData.option)
            } else if (isEditMode) {
                userData.option = null
            }
        } else if (isEditMode) {
            userData.option = null
        }

        try {
            if (isEditMode && selectedUser) {
                const response = await fetch(`/api/users/${selectedUser.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Erro ao atualizar lead')
            } else {
                const response = await fetch('/api/users', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(userData),
                })
                const result = await response.json()
                if (!response.ok) throw new Error(result.error || 'Erro ao criar lead')
            }

            setSuccess(true)
            await loadUsers()

            // Se criou novo, limpar form. Se editou, manter selecionado
            if (!isEditMode) {
                setTimeout(() => {
                    resetForm()
                }, 1500)
            }
        } catch (err: unknown) {
            console.error(`Erro ao ${isEditMode ? 'atualizar' : 'criar'} lead:`, err)

            // Mensagens de erro amigáveis baseadas no tipo de erro
            if (err instanceof Error) {
                const errorMessage = err.message.toLowerCase()

                if (errorMessage.includes('permission') || errorMessage.includes('policy') || errorMessage.includes('row-level security')) {
                    if (isEditMode) {
                        setError('Você não tem permissão para editar este usuário. Apenas administradores ou o próprio usuário podem editar seus dados.')
                    } else {
                        setError('Você não tem permissão para criar usuários. Apenas administradores podem realizar esta ação.')
                    }
                } else if (errorMessage.includes('duplicate') || errorMessage.includes('unique')) {
                    if (errorMessage.includes('phone')) {
                        setError('Este número de telefone já está cadastrado no sistema.')
                    } else {
                        setError('Já existe um registro com estas informações.')
                    }
                } else {
                    setError(err.message)
                }
            } else {
                setError(`Ocorreu um erro ao ${isEditMode ? 'atualizar' : 'cadastrar'} o lead.`)
            }
        } finally {
            setLoading(false)
        }
    }

    // ===== DELETE =====
    const handleDelete = async (userId: number) => {
        // Validação de permissões
        if (!isAdmin()) {
            setError('Apenas administradores podem deletar usuários')
            return
        }

        if (!confirm('Tem certeza que deseja excluir este lead?')) return

        try {
            setLoading(true)
            const response = await fetch(`/api/users/${userId}`, {
                method: 'DELETE',
            })

            if (!response.ok) {
                const data = await response.json()
                throw new Error(data.error || 'Erro ao excluir lead')
            }

            await loadUsers()
            if (selectedUser?.id === userId) {
                resetForm()
                setSelectedUser(null)
            }
        } catch (err: unknown) {
            console.error('Erro ao excluir lead:', err)
            // Mensagem de erro amigável baseada no tipo de erro
            if (err instanceof Error) {
                if (err.message.includes('permission') || err.message.includes('policy')) {
                    setError('Você não tem permissão para deletar usuários. Apenas administradores podem realizar esta ação.')
                } else {
                    setError(err.message)
                }
            } else {
                setError('Erro ao excluir lead')
            }
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full">
            {/* ===== COLUNA 1: LISTAGEM DE USUARIOS ===== */}
            <Card className="lg:col-span-1 overflow-hidden h-[calc(100vh-140px)] flex flex-col bg-slate-900/50 border-slate-800 backdrop-blur-sm" noPadding>
                <div className="p-4 border-b border-slate-800 bg-slate-950/50">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="bg-slate-800 p-1.5 rounded-lg">
                                <Users className="w-4 h-4 text-emerald-500" />
                            </div>
                            <h3 className="font-semibold text-white">Usuários</h3>
                            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full border border-slate-700">
                                {users.length}
                            </span>
                        </div>
                        {isAdmin() && (
                            <Button size="sm" icon={Plus} onClick={newLead} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20 shadow-lg">
                                Novo
                            </Button>
                        )}
                    </div>
                </div>

                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {loadingUsers ? (
                        <div className="p-8">
                            <LoadingSpinner message="Carregando..." />
                        </div>
                    ) : users.length === 0 ? (
                        <div className="p-8 text-center mt-10">
                            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Users className="w-8 h-8 text-slate-600" />
                            </div>
                            <p className="text-slate-300 text-sm font-medium">Nenhum lead cadastrado</p>
                            <p className="text-slate-500 text-xs mt-1">Clique em &quot;Novo&quot; para começar</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-800">
                            {users.map((user) => (
                                <div
                                    key={user.id}
                                    onClick={() => selectUser(user)}
                                    className={`p-4 cursor-pointer transition-all hover:bg-slate-800/50 ${selectedUser?.id === user.id
                                        ? 'bg-emerald-500/10 border-l-4 border-emerald-500'
                                        : 'border-l-4 border-transparent'
                                        }`}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-medium truncate ${selectedUser?.id === user.id ? 'text-emerald-400' : 'text-slate-200'
                                                }`}>
                                                {user.name || 'Sem nome'}
                                            </p>
                                            <p className="text-sm text-slate-500 truncate mt-0.5">
                                                {formatPhone(user.phone) || 'Sem telefone'}
                                            </p>
                                            {user.time_to_send !== null && user.time_to_send !== undefined && (
                                                <div className="flex items-center gap-1 mt-2 text-xs text-slate-400 bg-slate-800/50 w-fit px-2 py-1 rounded-md">
                                                    <Clock className="w-3 h-3 text-emerald-500" />
                                                    <span className="font-mono">{String(user.time_to_send).padStart(2, '0')}h</span>
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1 ml-2">
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    window.location.href = `/?id=${user.id}`;
                                                }}
                                                className="p-1.5 text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-colors"
                                                title="Ver dashboard"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                            </button>
                                            {canEdit(user.id) && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        selectUser(user);
                                                    }}
                                                    className={`p-1.5 rounded-lg transition-colors ${selectedUser?.id === user.id
                                                        ? 'text-emerald-400 bg-emerald-500/10'
                                                        : 'text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10'
                                                        }`}
                                                    title="Editar usuário"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                            )}
                                            {isAdmin() && (
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handleDelete(user.id);
                                                    }}
                                                    className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                    title="Deletar usuário"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </Card>

            {/* ===== COLUNA 2: DADOS PESSOAIS ===== */}
            <Card className="lg:col-span-1 bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <UserPlus className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">
                            {isEditMode ? 'Editar Lead' : 'Novo Lead'}
                        </h3>
                        <p className="text-xs text-slate-400">Dados pessoais</p>
                    </div>
                </div>

                {success && (
                    <div className="mb-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg flex items-center gap-2">
                        <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        <span className="text-sm text-emerald-400">
                            Lead {isEditMode ? 'atualizado' : 'criado'} com sucesso!
                        </span>
                    </div>
                )}

                {error && (
                    <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 text-red-500" />
                        <span className="text-sm text-red-400">{error}</span>
                    </div>
                )}

                <form id="lead-form" onSubmit={handleSubmit} className="space-y-4">
                    <p className="text-xs text-slate-500 mb-4">
                        Campos com <span className="text-red-500">*</span> são obrigatórios
                    </p>

                    {/* Nome */}
                    <FormField label="Nome" optional error={nameError}>
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
                                ? undefined
                                : !phoneError && !phoneValidated && phone.trim() !== ''
                                    ? 'Será validado ao sair do campo'
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
                            <p className="mt-1 text-xs text-emerald-400 flex items-center gap-1">
                                <CheckCircle2 className="w-3 h-3" />
                                Válido no WhatsApp
                            </p>
                        )}
                    </FormField>

                    {/* Hora do Envio */}
                    <FormField label="Hora do Envio" optional error={sendTimeError}>
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
                </form>
            </Card>

            {/* ===== COLUNA 3: INFORMAÇÃO DO DISPARO ===== */}
            <Card className="lg:col-span-1 bg-slate-900/50 border-slate-800 backdrop-blur-sm">
                <div className="flex items-center gap-2 mb-6 pb-4 border-b border-slate-800">
                    <div className="w-8 h-8 bg-gradient-to-br from-emerald-500 to-emerald-700 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                        </svg>
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Enquete WhatsApp</h3>
                        <p className="text-xs text-slate-400">Pergunta e opções</p>
                    </div>
                </div>

                {/* WhatsApp Poll Preview Container */}
                <div className="bg-slate-950/80 rounded-2xl p-4 shadow-xl border border-slate-800">

                    {/* Poll Header - Título */}
                    <div className="mb-4">
                        <div className="flex items-center gap-2 mb-2">
                            <span className="text-xs text-slate-400 uppercase tracking-wide font-medium">Pergunta da enquete</span>
                            {titleError && <span className="text-xs text-red-500">• {titleError}</span>}
                        </div>
                        <input
                            type="text"
                            form="lead-form"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            className={`w-full bg-slate-900/50 border ${titleError ? 'border-red-500/50' : 'border-slate-700'} rounded-xl px-4 py-3 text-white text-base font-medium placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all`}
                            placeholder={`Ex: Como foi o dia ${new Date().toLocaleDateString('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })}`}

                        />
                    </div>

                    {/* Poll Instruction */}
                    <div className="flex items-center gap-2 mb-4 text-slate-400 text-sm">
                        <span className="text-lg">📊</span>
                        <span>Opções da enquete</span>
                    </div>

                    {/* Poll Options */}
                    <div className="space-y-2 mb-4">
                        {checklistItems.map((item, index) => (
                            <div
                                key={index}
                                className="group relative bg-slate-800/40 hover:bg-slate-800/60 border border-slate-700 rounded-xl px-4 py-3 transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="w-5 h-5 rounded-full border-2 border-emerald-500 bg-emerald-500 flex items-center justify-center flex-shrink-0 shadow-lg shadow-emerald-500/20">
                                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <span className="flex-1 text-slate-200 text-sm">{item}</span>
                                    <button
                                        type="button"
                                        onClick={() => removeChecklistItem(index)}
                                        className="opacity-0 group-hover:opacity-100 p-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-all"
                                    >
                                        <X className="w-3 h-3" />
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
                                    className={`w-full bg-slate-900/50 border ${checklistError && checklistItems.length === 0 ? 'border-red-500/50' : 'border-slate-700'} rounded-xl px-4 py-2.5 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all pr-10`}
                                    placeholder="Ex: 🏋️ Academia"
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-600 text-sm">📝</span>
                            </div>
                            <button
                                type="button"
                                onClick={addChecklistItem}
                                disabled={checklistInput.trim() === ''}
                                className="px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 disabled:from-slate-800 disabled:to-slate-800 disabled:text-slate-600 disabled:cursor-not-allowed text-white rounded-xl transition-all shadow-lg shadow-emerald-500/20"
                            >
                                <Plus className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* Empty State */}
                    {checklistItems.length === 0 && (
                        <div className={`p-4 rounded-xl border-2 border-dashed ${checklistError ? 'border-red-500/50 bg-red-500/10' : 'border-slate-600 bg-slate-800/50'} text-center`}>
                            <span className="text-3xl mb-2 block opacity-50">📋</span>
                            <p className={`text-xs ${checklistError ? 'text-red-400' : 'text-slate-500'}`}>
                                {checklistError || 'Adicione opções para a enquete'}
                            </p>
                        </div>
                    )}
                </div>

                {/* Poll Footer */}
                {checklistItems.length > 0 && (
                    <div className="flex items-center justify-between pt-3 border-t border-slate-700 px-4 pb-4">
                        <span className="text-xs text-slate-500">
                            {checklistItems.length} opç{checklistItems.length === 1 ? 'ão' : 'ões'}
                        </span>
                        <span className="text-xs text-emerald-400 font-medium">✓ Pronto</span>
                    </div>
                )}

                {/* Actions */}
                <div className="flex gap-3 mt-6 pt-6 border-t border-slate-800">
                    <Button
                        type="submit"
                        form="lead-form"
                        disabled={loading || phoneValidating}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20"
                        icon={isEditMode ? Save : UserPlus}
                    >
                        {loading
                            ? (isEditMode ? 'Salvando...' : 'Criando...')
                            : (isEditMode ? 'Salvar' : 'Criar Lead')
                        }
                    </Button>
                    {isEditMode && (
                        <Button
                            type="button"
                            variant="secondary"
                            onClick={newLead}
                            disabled={loading}
                            className="bg-transparent border-slate-700 text-slate-300 hover:bg-slate-800 hover:text-white"
                        >
                            Cancelar
                        </Button>
                    )}
                </div>
            </Card >

            {loading && <LoadingOverlay message={isEditMode ? 'Salvando...' : 'Criando lead...'} />
            }
        </div >
    )
}
