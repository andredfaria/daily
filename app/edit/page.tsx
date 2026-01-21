'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import UserForm from '@/components/UserForm'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'
import { useAuth } from '@/components/AuthProvider'

function EditPageContent() {
  const { canEdit, isAdmin } = useAuth()
  const searchParams = useSearchParams()
  const userId = searchParams.get('id')
  const [user, setUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authorized, setAuthorized] = useState(false)

  useEffect(() => {
    const loadUser = async () => {
      if (!userId) {
        setError('ID do usuário não fornecido')
        setLoading(false)
        return
      }

      try {
        setLoading(true)
        setError(null)

        // Validar permissões via API
        const validateResponse = await fetch(`/api/users/${userId}/validate-edit`)
        const validateData = await validateResponse.json()

        if (!validateData.authorized) {
          setError(validateData.error || 'Você não tem permissão para editar este usuário')
          setAuthorized(false)
          setLoading(false)
          return
        }

        setAuthorized(true)

        // Buscar dados do usuário
        const { data, error: fetchError } = await supabase
          .from('daily_user')
          .select('*')
          .eq('id', parseInt(userId))
          .single()

        if (fetchError) {
          // Se o erro for de permissão ou usuário não encontrado, tratar adequadamente
          if (fetchError.code === 'PGRST116') {
            throw new Error('Usuário não encontrado')
          }
          throw fetchError
        }

        if (!data) {
          throw new Error('Usuário não encontrado')
        }

        // Verificação adicional client-side com canEdit
        if (!canEdit(data.id)) {
          setError('Você não tem permissão para editar este usuário')
          setAuthorized(false)
          setLoading(false)
          return
        }

        setUser(data as DailyUser)
      } catch (err: unknown) {
        console.error('[EDIT PAGE] Erro ao carregar usuário:', err)
        const errorMessage = err instanceof Error ? err.message : 'Erro ao carregar dados do usuário'
        
        // Mensagem mais específica se for erro de vinculação
        if (errorMessage.includes('permission') || errorMessage.includes('vinculação')) {
          setError('Erro ao verificar permissões. Tente recarregar a página.')
        } else {
          setError(errorMessage)
        }
        
        setAuthorized(false)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          <LoadingSpinner message="Carregando usuário..." />
        </main>
      </div>
    )
  }

  if (error || !user || !authorized) {
    return (
      <div className="min-h-screen bg-slate-950">
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          <ErrorMessage
            message={error || 'Usuário não encontrado ou acesso negado'}
            showCreateButton={false}
          />
          <div className="mt-4 text-center">
            <button
              onClick={() => window.location.reload()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Recarregar Página
            </button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar title="Editar Usuário" showBack />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="fade-in">
          <UserForm user={user} showAdminFields={isAdmin()} />
        </div>
      </main>
    </div>
  )
}

export default function EditPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950">
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
          <LoadingSpinner message="Carregando..." />
        </main>
      </div>
    }>
      <EditPageContent />
    </Suspense>
  )
}
