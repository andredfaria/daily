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
  const { canEdit } = useAuth()
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

        if (fetchError) throw fetchError

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
      } catch (err: any) {
        console.error('Erro ao carregar usuário:', err)
        setError(err.message || 'Erro ao carregar dados do usuário')
        setAuthorized(false)
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [userId, canEdit])

  if (loading) {
    return (
      <>
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner message="Carregando usuário..." />
        </main>
      </>
    )
  }

  if (error || !user || !authorized) {
    return (
      <>
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage
            message={error || 'Usuário não encontrado ou acesso negado'}
            showCreateButton={false}
          />
        </main>
      </>
    )
  }

  const { isAdmin } = useAuth()

  return (
    <>
      <Navbar title="Editar Usuário" showBack />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="fade-in">
          <UserForm user={user} showAdminFields={isAdmin()} />
        </div>
      </main>
    </>
  )
}

export default function EditPage() {
  return (
    <Suspense fallback={
      <>
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <LoadingSpinner message="Carregando..." />
        </main>
      </>
    }>
      <EditPageContent />
    </Suspense>
  )
}
