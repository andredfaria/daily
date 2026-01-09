'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Mail, Lock, UserPlus } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'
import Alert from './ui/Alert'

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
      router.push('/dashboard')
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
    <Card className="w-full max-w-md mx-auto" variant="glass">
      <div className="text-center mb-6">
        <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          {currentMode === 'login' ? (
            <LogIn className="text-emerald-500 w-8 h-8" />
          ) : (
            <UserPlus className="text-emerald-500 w-8 h-8" />
          )}
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">
          {currentMode === 'login' ? 'Entrar no Sistema' : 'Criar Conta'}
        </h1>
        <p className="text-slate-400 text-sm">
          {currentMode === 'login'
            ? 'Digite suas credenciais para acessar'
            : 'Preencha os dados para criar sua conta'}
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {currentMode === 'register' && (
          <>
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-slate-300 mb-1">
                Nome
              </label>
              <Input
                type="text"
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Seu nome completo"
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">
                Telefone (opcional)
              </label>
              <Input
                type="tel"
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="(00) 00000-0000"
                disabled={loading}
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="email" className="block text-sm font-medium text-slate-300 mb-1">
            Email
          </label>
          <Input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            leftIcon={Mail}
            required
            disabled={loading}
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
            Senha
          </label>
          <Input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            leftIcon={Lock}
            required
            minLength={6}
            disabled={loading}
          />
          {currentMode === 'register' && (
            <p className="text-xs text-slate-500 mt-1">Mínimo de 6 caracteres</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          loading={loading}
          icon={currentMode === 'login' ? LogIn : UserPlus}
        >
          {currentMode === 'login' ? 'Entrar' : 'Criar Conta'}
        </Button>
      </form>

      <div className="mt-6 pt-6 border-t border-slate-800 text-center">
        <p className="text-sm text-slate-400">
          {currentMode === 'login' ? (
            <>
              Não tem uma conta?{' '}
              <button
                type="button"
                onClick={toggleMode}
                className="text-emerald-400 font-medium hover:underline hover:text-emerald-300 transition-colors"
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
                className="text-emerald-400 font-medium hover:underline hover:text-emerald-300 transition-colors"
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
