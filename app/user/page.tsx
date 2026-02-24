'use client'

import { Suspense, useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import UserForm from '@/components/UserForm'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import { DailyUser } from '@/lib/types'
import { useAuth } from '@/components/AuthProvider'

function UserSettingsPageContent() {
    const { user, dailyUser, loading: authLoading } = useAuth()
    const [currentUser, setCurrentUser] = useState<DailyUser | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (authLoading) return

        if (!user) {
            setError('Você precisa estar logado para acessar esta página')
            setLoading(false)
            return
        }

        if (dailyUser) {
            setCurrentUser(dailyUser)
            setLoading(false)
        } else {
            // Fallback: buscar via API se dailyUser não estiver no context
            const fetchUser = async () => {
                try {
                    const response = await fetch(`/api/users/${user.id}`)
                    if (!response.ok) {
                        throw new Error('Erro ao carregar dados do usuário')
                    }
                    const data = await response.json()
                    setCurrentUser(data)
                } catch (err) {
                    setError(err instanceof Error ? err.message : 'Erro genérico')
                } finally {
                    setLoading(false)
                }
            }
            fetchUser()
        }
    }, [user, dailyUser, authLoading])

    if (loading || authLoading) {
        return (
            <div className="min-h-screen bg-slate-950">
                <Navbar title="Minha Conta" showBack />
                <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
                    <LoadingSpinner message="Carregando seus dados..." />
                </main>
            </div>
        )
    }

    if (error || !currentUser) {
        return (
            <div className="min-h-screen bg-slate-950">
                <Navbar title="Minha Conta" showBack />
                <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
                    <ErrorMessage
                        message={error || 'Erro ao carregar configurações'}
                        showCreateButton={false}
                    />
                </main>
            </div>
        )
    }

    return (
        <div className="min-h-screen bg-slate-950">
            <Navbar title="Minha Conta" showBack />
            <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
                <div className="fade-in">
                    <h2 className="text-2xl font-bold text-white mb-6">Configurações da Conta</h2>
                    <UserForm user={currentUser} embedded />
                </div>
            </main>
        </div>
    )
}

export default function UserSettingsPage() {
    return (
        <Suspense fallback={<LoadingSpinner message="Carregando..." />}>
            <UserSettingsPageContent />
        </Suspense>
    )
}
