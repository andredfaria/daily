'use client'

import { useState, useEffect, useCallback } from 'react'
import { DailyData } from '@/lib/types'

interface UseActivitiesOptions {
  userId: string | number | null | undefined
  autoLoad?: boolean
  orderBy?: string
  orderDirection?: 'asc' | 'desc'
}

interface UseActivitiesReturn {
  activities: DailyData[]
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  stats: {
    total: number
    completed: number
    completionRate: number
  }
}

/**
 * Hook para buscar atividades de um usuário via /api/daily-data
 */
export function useActivities(options: UseActivitiesOptions): UseActivitiesReturn {
  const {
    userId,
    autoLoad = true,
    orderBy = 'activity_date',
    orderDirection = 'desc',
  } = options

  const [activities, setActivities] = useState<DailyData[]>([])
  const [loading, setLoading] = useState(autoLoad && !!userId)
  const [error, setError] = useState<Error | null>(null)

  const fetchActivities = useCallback(async () => {
    if (!userId) {
      setActivities([])
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        userId: String(userId),
        orderBy,
        orderDirection,
      })

      const response = await fetch(`/api/daily-data?${params}`)
      if (!response.ok) throw new Error(`Erro ao buscar atividades: ${response.status}`)

      const data = await response.json()
      setActivities(data.activities || [])
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err))
      setError(error)
      setActivities([])
      console.error('Erro ao carregar atividades:', error)
    } finally {
      setLoading(false)
    }
  }, [userId, orderBy, orderDirection])

  useEffect(() => {
    if (autoLoad) {
      fetchActivities()
    }
  }, [autoLoad, fetchActivities])

  const stats = {
    total: activities.length,
    completed: activities.filter(a => a.check_status).length,
    completionRate:
      activities.length > 0
        ? Math.round((activities.filter(a => a.check_status).length / activities.length) * 100)
        : 0,
  }

  return { activities, loading, error, refetch: fetchActivities, stats }
}
