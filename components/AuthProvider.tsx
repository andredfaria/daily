'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { DailyUser } from '@/lib/types'

// Tipo simplificado de usuário (sem Supabase Auth)
interface AuthUser {
  id: number
  phone: string
  email?: string
  isAdmin: boolean
}

interface AuthContextType {
  user: AuthUser | null
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
  const [user, setUser] = useState<AuthUser | null>(null)
  const [dailyUser, setDailyUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(true)

  const loadUser = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me')

      if (response.status === 401 || response.status === 403) {
        setUser(null)
        setDailyUser(null)
        // Redireciona para /login se não estiver em rota pública
        const publicPaths = ['/login', '/register', '/forgot-password', '/reset-password', '/']
        const isPublic = publicPaths.some(p => window.location.pathname === p || window.location.pathname.startsWith(p + '/'))
        if (!isPublic) {
          window.location.href = '/login'
        }
        return
      }

      if (response.ok) {
        const result = await response.json()
        setUser(result.user ? {
          id: result.user.id,
          phone: result.user.phone,
          email: result.user.email,
          isAdmin: result.user.is_admin,
        } : null)
        setDailyUser(result.dailyUser || null)
      } else {
        console.error('[AuthProvider] Erro inesperado ao buscar usuário:', response.status)
        setUser(null)
        setDailyUser(null)
      }
    } catch (error) {
      console.error('[AuthProvider] Erro ao carregar usuário:', error)
      setUser(null)
      setDailyUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadUser()
  }, [loadUser])

  const signOut = async () => {
    await fetch('/api/auth/logout', { method: 'POST' })
    setUser(null)
    setDailyUser(null)
  }

  const refreshUser = useCallback(async () => {
    await loadUser()
  }, [loadUser])

  const isAdmin = useCallback((): boolean => {
    return dailyUser?.is_admin === true
  }, [dailyUser?.is_admin])

  const canEdit = useCallback((userId: number): boolean => {
    if (!dailyUser) return false
    if (dailyUser.is_admin) return true
    return dailyUser.id === userId
  }, [dailyUser])

  const isSubscriptionActive = useCallback((): boolean => {
    if (!dailyUser) return false
    if (dailyUser.is_admin) return true
    if (dailyUser.subscription_status === 'active') {
      if (!dailyUser.subscription_ends_at) return true
      return new Date(dailyUser.subscription_ends_at) > new Date()
    }
    if (dailyUser.subscription_status === 'trial') {
      if (!dailyUser.trial_ends_at) return false
      return new Date(dailyUser.trial_ends_at) > new Date()
    }
    return false
  }, [dailyUser])

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
