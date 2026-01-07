'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'

interface UseUserReturn {
  user: DailyUser | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook para buscar e gerenciar um usuário específico
 */
export function useUser(userId: string | number | null | undefined): UseUserReturn {
  const [user, setUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(!!userId)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    if (!userId) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('daily_user')
        .select('*')
        .eq('id', userId)
        .single()

      if (fetchError) throw fetchError
      if (!data) throw new Error('Usuário não encontrado')

      setUser(data as DailyUser)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setUser(null)
      console.error('Erro ao carregar usuário:', error)
    } finally {
      setLoading(false)
    }
  }, [userId])

  useEffect(() => {
    fetchUser()
  }, [fetchUser])

  return {
    user,
    loading,
    error,
    refetch: fetchUser,
  }
}
