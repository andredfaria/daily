'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import Button from './ui/Button'
import Card from './ui/Card'
import { LogIn, Mail, Lock, AlertCircle, UserPlus } from 'lucide-react'

interface LoginFormProps {
  mode?: 'login' | 'register'
}

export default function LoginForm({ mode = 'login' }: LoginFormProps) {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<'login' | 'register'>(mode)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = currentMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = currentMode === 'login' 
        ? { email, password }
        : { email, password, name, phone }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao autenticar')
      }

      // Redirecionar para a home após login/registro bem-sucedido
      router.push('/')
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao processar solicitação')
    } finally {
      setLoading(false)
    }
  }

  const toggleMode = () => {
    setCurrentMode(currentMode === 'login' ? 'register' : 'login')
    setError(null)
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <div className="text-center mb-6">
        <div className="bg-indigo-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          {currentMode === 'login' ? (
            <LogIn className="text-indigo-600 w-8 h-8" />
          ) : (
            <UserPlus className="text-indigo-600 w-8 h-8" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-slate-900 mb-2">
          {currentMode === 'login' ? 'Entrar no Sistema' : 'Criar Conta'}
        </h1>
        <p className="text-slate-600 text-sm">
          {currentMode === 'login' 
            ? 'Digite suas credenciais para acessar' 
            : 'Preencha os dados para criar sua conta'}
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {currentMode === 'register' && (
          <>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1">
                Nome
              </label>
              <input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="Seu nome completo"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-700 mb-1">
                Telefone (opcional)
              </label>
              <input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                placeholder="(00) 00000-0000"
                disabled={loading}
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
            Email
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="seu@email.com"
              required
              disabled={loading}
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
            Senha
          </label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
              required
              minLength={6}
              disabled={loading}
            />
          </div>
          {currentMode === 'register' && (
            <p className="text-xs text-slate-500 mt-1">Mínimo de 6 caracteres</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          icon={currentMode === 'login' ? LogIn : UserPlus}
        >
          {loading 
            ? 'Processando...' 
            : currentMode === 'login' ? 'Entrar' : 'Criar Conta'}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-200 text-center">
        <p className="text-sm text-slate-600">
          {currentMode === 'login' ? (
            <>
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-indigo-600 font-medium hover:underline"
                disabled={loading}
              >
                Criar conta
              </button>
            </>
          ) : (
            <>
              Já tem uma conta?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-indigo-600 font-medium hover:underline"
                disabled={loading}
              >
                Fazer login
              </button>
            </>
          )}
        </p>
      </div>
    </Card>
  )
}
