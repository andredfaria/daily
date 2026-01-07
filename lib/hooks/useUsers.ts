'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'

interface UseUsersOptions {
  autoLoad?: boolean
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

interface UseUsersReturn {
  users: DailyUser[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook para gerenciar lista de usuários com cache simples
 */
export function useUsers(options: UseUsersOptions = {}): UseUsersReturn {
  const {
    autoLoad = true,
    orderBy = 'created_at',
    orderDirection = 'desc',
  } = options

  const [users, setUsers] = useState<DailyUser[]>([])
  const [loading, setLoading] = useState(autoLoad)
  const [error, setError] = useState<Error | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const { data, error: fetchError } = await supabase
        .from('daily_user')
        .select('*')
        .order(orderBy, { ascending: orderDirection === 'asc' })

      if (fetchError) throw fetchError

      setUsers((data as DailyUser[]) || [])
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }, [orderBy, orderDirection])

  useEffect(() => {
    if (autoLoad) {
      fetchUsers()
    }
  }, [autoLoad, fetchUsers])

  return {
    users,
    loading,
    error,
    refetch: fetchUsers,
    refresh: fetchUsers,
  }
}
