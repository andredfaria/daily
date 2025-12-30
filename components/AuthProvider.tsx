'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { DailyUser } from '@/lib/types'

interface AuthContextType {
  user: User | null
  dailyUser: DailyUser | null
  loading: boolean
  signOut: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [dailyUser, setDailyUser] = useState<DailyUser | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchDailyUser = async (authUserId: string) => {
    const { data: dailyUserData, error } = await supabase
      .from('daily_user')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single()

    if (error) {
      console.error('Erro ao buscar daily_user:', error)
      setDailyUser(null)
    } else if (dailyUserData) {
      setDailyUser(dailyUserData as DailyUser)
    } else {
      setDailyUser(null)
    }
  }

  const loadUser = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser()
      setUser(authUser)

      if (authUser) {
        // Buscar daily_user associado
        await fetchDailyUser(authUser.id)
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
          await fetchDailyUser(session.user.id)
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

  return (
    <AuthContext.Provider value={{ user, dailyUser, loading, signOut, refreshUser }}>
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
