'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
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
 * Hook para buscar atividades de um usuário com estatísticas
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

      const { data, error: fetchError } = await supabase
        .from('daily_data')
        .select('*')
        .eq('id_user', userId)
        .order(orderBy, { ascending: orderDirection === 'asc' })

      if (fetchError) throw fetchError

      setActivities((data as DailyData[]) || [])
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

  // Calcular estatísticas
  const stats = {
    total: activities.length,
    completed: activities.filter(a => a.check_status).length,
    completionRate:
      activities.length > 0
        ? Math.round((activities.filter(a => a.check_status).length / activities.length) * 100)
        : 0,
  }

  return {
    activities,
    loading,
    error,
    refetch: fetchActivities,
    stats,
  }
}
