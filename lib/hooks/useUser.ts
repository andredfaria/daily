'use client'

import { useState, useEffect, useCallback } from 'react'
import { DailyUser } from '@/lib/types'

interface UseUserReturn {
  user: DailyUser | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

/**
 * Hook para buscar um usuário específico pelo ID via /api/users/[id]
 * Se userId não for fornecido, busca o usuário autenticado via /api/auth/me
 */
export function useUser(userId: string | number | null | undefined): UseUserReturn {
  const [user, setUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchUser = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)

      let response: Response

      if (userId) {
        response = await fetch(`/api/users/${userId}`)
      } else {
        response = await fetch('/api/auth/me')
      }

      if (!response.ok) {
        if (response.status === 404) {
          setUser(null)
          return
        }
        if (response.status === 401 || response.status === 403) {
          setUser(null)
          // Redireciona para /login se não estiver em rota pública
          const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/']
          const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'))
          if (!isPublic) {
            window.location.href = '/login'
          }
          return
        }
        throw new Error(`Erro ao buscar usuário: ${response.status}`)
      }

      const data = await response.json()
      // /api/auth/me retorna { user, dailyUser }, /api/users/[id] retorna o user diretamente
      setUser(data.dailyUser || data || null)
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

  return { user, loading, error, refetch: fetchUser }
}
