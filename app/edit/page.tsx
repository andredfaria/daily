'use client'

import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Navbar from '@/components/Navbar'
import UserForm from '@/components/UserForm'
import LoadingSpinner from '@/components/LoadingSpinner'
import ErrorMessage from '@/components/ErrorMessage'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'

function EditPageContent() {
  const searchParams = useSearchParams()
  const userId = searchParams.get('id')
  const [user, setUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

        const { data, error: fetchError } = await supabase
          .from('daily_user')
          .select('*')
          .eq('id', parseInt(userId))
          .single()

        if (fetchError) throw fetchError

        if (!data) {
          throw new Error('Usuário não encontrado')
        }

        setUser(data as DailyUser)
      } catch (err: any) {
        console.error('Erro ao carregar usuário:', err)
        setError(err.message || 'Erro ao carregar dados do usuário')
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [userId])

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

  if (error || !user) {
    return (
      <>
        <Navbar title="Editar Usuário" showBack />
        <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <ErrorMessage
            message={error || 'Usuário não encontrado'}
            showCreateButton={false}
          />
        </main>
      </>
    )
  }

  return (
    <>
      <Navbar title="Editar Usuário" showBack />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="fade-in">
          <UserForm user={user} />
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
