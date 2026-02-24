'use client'

import { useState, useEffect, useCallback } from 'react'
import { DailyUser } from '@/lib/types'

interface UseUsersOptions {
  autoLoad?: boolean
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
  page?: number
  limit?: number
}

interface UseUsersReturn {
  users: DailyUser[]
  loading: boolean
  error: Error | null
  total: number
  refetch: () => Promise<void>
  refresh: () => Promise<void>
}

/**
 * Hook para gerenciar lista de usuários — usa o endpoint /api/users (MySQL)
 */
export function useUsers(options: UseUsersOptions = {}): UseUsersReturn {
  const {
    autoLoad = true,
    orderBy = 'created_at',
    orderDirection = 'desc',
    page = 1,
    limit = 50,
  } = options

  const [users, setUsers] = useState<DailyUser[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(autoLoad)
  const [error, setError] = useState<Error | null>(null)

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        page: String(page),
        limit: String(limit),
        orderBy,
        orderDirection,
      })

      const response = await fetch(`/api/users?${params}`)
      if (!response.ok) {
        throw new Error(`Erro ao buscar usuários: ${response.status}`)
      }

      const result = await response.json()
      setUsers(result.data || [])
      setTotal(result.pagination?.total || 0)
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      console.error('Erro ao carregar usuários:', error)
    } finally {
      setLoading(false)
    }
  }, [orderBy, orderDirection, page, limit])

  useEffect(() => {
    if (autoLoad) {
      fetchUsers()
    }
  }, [autoLoad, fetchUsers])

  return {
    users,
    loading,
    error,
    total,
    refetch: fetchUsers,
    refresh: fetchUsers,
  }
}
