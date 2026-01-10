'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'

interface AuthContextType {
  user: User | null
  dailyUser: DailyUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
  isAdmin: () => boolean
  canEdit: (userId: number) => boolean
  isSubscriptionActive: () => boolean
  isTrialExpiringSoon: () => boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [dailyUser, setDailyUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (authUser) {
        // Buscar daily_user associado
        const { data: dailyUserData } = await supabase
          .from('daily_user')
          .select('*')
          .eq('auth_user_id', authUser.id)
          .single()

        setDailyUser(dailyUserData as DailyUser)
      } else {
        setDailyUser(null)
      }
    } catch (error) {
      console.error('Erro ao carregar usuário:', error)
      setUser(null)
      setDailyUser(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUser()

    // Escutar mudanças no estado de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null)

        if (session?.user) {
          // Buscar daily_user quando usuário fizer login
          const { data: dailyUserData } = await supabase
            .from('daily_user')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single()

          setDailyUser(dailyUserData as DailyUser)
        } else {
          setDailyUser(null)
        }

        setLoading(false)
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setDailyUser(null)
  }

  const refreshUser = async () => {
    await loadUser()
  }

  // Verifica se o usuário atual é administrador
  const isAdmin = useCallback((): boolean => {
    return dailyUser?.is_admin === true
  }, [dailyUser?.is_admin])

  // Verifica se o usuário atual pode editar um determinado usuário
  // Admin pode editar todos, não-admin pode editar apenas seus próprios dados
  const canEdit = useCallback((userId: number): boolean => {
    if (!dailyUser) return false
    if (dailyUser.is_admin) return true
    return dailyUser.id === userId
  }, [dailyUser])

  // Verifica se a assinatura está ativa (trial válido ou assinatura paga)
  const isSubscriptionActive = useCallback((): boolean => {
    if (!dailyUser) return false

    // Admins sempre têm acesso
    if (dailyUser.is_admin) return true

    // Verificar assinatura ativa
    if (dailyUser.subscription_status === 'active') {
      if (!dailyUser.subscription_ends_at) return true
      return new Date(dailyUser.subscription_ends_at) > new Date()
    }

    // Verificar trial ativo
    if (dailyUser.subscription_status === 'trial') {
      if (!dailyUser.trial_ends_at) return false
      return new Date(dailyUser.trial_ends_at) > new Date()
    }

    return false
  }, [dailyUser])

  // Verifica se o trial está próximo de expirar (últimos 2 dias)
  const isTrialExpiringSoon = useCallback((): boolean => {
    if (!dailyUser || dailyUser.is_admin) return false
    if (dailyUser.subscription_status !== 'trial') return false
    if (!dailyUser.trial_ends_at) return false

    const now = new Date()
    const trialEnd = new Date(dailyUser.trial_ends_at)
    const daysRemaining = Math.ceil((trialEnd.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    return daysRemaining <= 2 && daysRemaining > 0
  }, [dailyUser])

  return (
    <AuthContext.Provider value={{
      user,
      dailyUser,
      loading,
      signOut,
      refreshUser,
      isAdmin,
      canEdit,
      isSubscriptionActive,
      isTrialExpiringSoon
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
