import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'
import client, { TOKEN_KEY } from '../api/client'
import type { User } from '../types'

interface AuthContextValue {
  user: User | null
  token: string | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (token: string, user: User) => void
  logout: () => void
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY)
    if (!stored) {
      setIsLoading(false)
      return
    }
    // Token de antes das sessões (JWT de 30 dias, três partes com ponto): troca
    // por uma sessão de dispositivo antes de qualquer outra chamada, que já não
    // aceita JWT.
    const upgrade = stored.split('.').length === 3
      ? client
          .post<{ token: string }>('/auth/upgrade-session', null, { headers: { Authorization: `Bearer ${stored}` } })
          .then((res) => {
            localStorage.setItem(TOKEN_KEY, res.data.token)
            return res.data.token
          })
      : Promise.resolve(stored)

    upgrade
      .then((sessionToken) => {
        setToken(sessionToken)
        return client.get('/auth/me', { headers: { Authorization: `Bearer ${sessionToken}` } })
      })
      .then((res) => {
        setUser(res.data)
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY)
      })
      .finally(() => {
        setIsLoading(false)
      })
  }, [])

  const login = useCallback((newToken: string, newUser: User) => {
    localStorage.setItem(TOKEN_KEY, newToken)
    setToken(newToken)
    setUser(newUser)
  }, [])

  const logout = useCallback(() => {
    // Encerra no servidor também: apagar só do navegador deixava o token válido.
    // Sem esperar a resposta — sair não pode travar por falha de rede.
    // Header explícito: o interceptor roda depois do removeItem abaixo.
    const current = localStorage.getItem(TOKEN_KEY)
    if (current) {
      client.post('/auth/logout', null, { headers: { Authorization: `Bearer ${current}` } }).catch(() => {})
    }
    localStorage.removeItem(TOKEN_KEY)
    setToken(null)
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    const res = await client.get('/auth/me')
    setUser(res.data)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
