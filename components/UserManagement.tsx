'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, UserPlus, RefreshCw } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'
import UserForm from './UserForm'
import LoadingSpinner from './LoadingSpinner'
import ErrorMessage from './ErrorMessage'
import Button from './ui/Button'
import Card from './ui/Card'

export default function UserManagement() {
    const [users, setUsers] = useState<DailyUser[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [selectedUser, setSelectedUser] = useState<DailyUser | null>(null)
    const [formKey, setFormKey] = useState(0) // Key para forçar reset do formulário

    const loadUsers = useCallback(async () => {
        try {
            setLoading(true)
            setError(null)

            const { data, error: fetchError } = await supabase
                .from('daily_user')
                .select('*')
                .order('created_at', { ascending: false })

            if (fetchError) throw fetchError

            setUsers((data as DailyUser[]) || [])
        } catch (err: any) {
            console.error('Erro ao carregar usuários:', err)
            setError(err.message || 'Erro ao carregar lista de usuários')
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        loadUsers()
    }, [loadUsers])

    const handleUserSelect = (user: DailyUser) => {
        setSelectedUser(user)
        setFormKey(prev => prev + 1) // Forçar remontagem do form com novos dados
    }

    const handleNewUser = () => {
        setSelectedUser(null)
        setFormKey(prev => prev + 1) // Forçar reset do form
    }

    const handleFormSuccess = async () => {
        await loadUsers() // Recarregar lista
        if (!selectedUser) {
            // Se estava criando, limpar form
            setFormKey(prev => prev + 1)
        }
    }

    const handleFormCancel = () => {
        setSelectedUser(null)
        setFormKey(prev => prev + 1)
    }

    // Formatar hora de envio (time_to_send está em minutos)
    const formatSendTime = (minutes: number | null): string => {
        if (minutes === null || minutes === undefined) return '-'
        const hours = Math.floor(minutes / 60)
        return `${String(hours).padStart(2, '0')}h`
    }

    // Formatar data
    const formatDate = (dateStr: string): string => {
        return new Date(dateStr).toLocaleDateString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric'
        })
    }

    // Formatar telefone (extrair número do chatId se necessário)
    const formatPhone = (phone: string | null): string => {
        if (!phone) return 'Sem telefone'
        // Remove @c.us se presente
        return phone.includes('@') ? phone.split('@')[0] : phone
    }

    if (loading && users.length === 0) {
        return <LoadingSpinner message="Carregando usuários..." />
    }

    if (error && users.length === 0) {
        return <ErrorMessage message={error} />
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
            {/* Painel da Lista (40%) */}
            <div className="lg:col-span-2">
                <Card
                    title="Usuários"
                    headerActions={
                        <div className="flex items-center gap-2">
                            <span className="text-sm text-slate-500">
                                {users.length} usuário{users.length !== 1 ? 's' : ''}
                            </span>
                            <Button
                                variant="secondary"
                                size="sm"
                                icon={RefreshCw}
                                onClick={loadUsers}
                                disabled={loading}
                                className="!p-2"
                            >
                                <span className="sr-only">Atualizar</span>
                            </Button>
                        </div>
                    }
                    noPadding
                    className="h-fit"
                >
                    {users.length === 0 ? (
                        <div className="p-8 text-center">
                            <div className="bg-slate-100 p-4 rounded-full w-fit mx-auto mb-4">
                                <Users className="w-8 h-8 text-slate-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-slate-900 mb-1">
                                Nenhum usuário encontrado
                            </h3>
                            <p className="text-sm text-slate-500">
                                Crie seu primeiro usuário usando o formulário ao lado
                            </p>
                        </div>
                    ) : (
                        <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => handleUserSelect(user)}
                                    className={`w-full text-left px-4 py-3 hover:bg-slate-50 transition-colors ${selectedUser?.id === user.id
                                        ? 'bg-indigo-50 border-l-4 border-indigo-600'
                                        : ''
                                        }`}
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-slate-900 truncate">
                                                {user.name || 'Sem nome'}
                                            </p>
                                            <p className="text-sm text-slate-500 truncate">
                                                {user.title || 'Sem título'}
                                            </p>
                                        </div>
                                        <div className="text-right ml-3">
                                            <p className="text-xs text-slate-400">#{user.id}</p>
                                            <p className="text-xs text-slate-400">
                                                {formatSendTime(user.time_to_send)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                                        <span>{formatPhone(user.phone)}</span>
                                        <span>•</span>
                                        <span>{formatDate(user.created_at)}</span>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </Card>
            </div>

            {/* Painel do Formulário (60%) */}
            <div className="lg:col-span-3">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-slate-900">
                        {selectedUser ? `Editando: ${selectedUser.name || 'Usuário #' + selectedUser.id}` : 'Novo Usuário'}
                    </h2>
                    {selectedUser && (
                        <Button
                            variant="secondary"
                            size="sm"
                            icon={UserPlus}
                            onClick={handleNewUser}
                        >
                            Novo Usuário
                        </Button>
                    )}
                </div>

                <UserForm
                    key={formKey}
                    user={selectedUser || undefined}
                    onSuccess={handleFormSuccess}
                    onCancel={selectedUser ? handleFormCancel : undefined}
                    embedded
                />
            </div>
        </div>
    )
}
