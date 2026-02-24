'use client'

import { useState, FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { LogIn, Phone, Lock, UserPlus, Gift, CheckCircle2, X, Mail } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'
import Alert from './ui/Alert'
import { useToast } from './ToastProvider'

interface LoginFormProps {
  mode?: 'login' | 'register'
}

export default function LoginForm({ mode = 'login' }: LoginFormProps) {
  const router = useRouter()
  const toast = useToast()
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [currentMode, setCurrentMode] = useState<'login' | 'register'>(mode)
  const [phoneTouched, setPhoneTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [nameTouched, setNameTouched] = useState(false)

  // Validações
  const isPhoneValid = phone.length === 0 || phone.trim().length >= 8
  const isPasswordValid = password.length === 0 || password.length >= 6
  const isNameValid = name.length === 0 || name.trim().length >= 2

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const endpoint = currentMode === 'login' ? '/api/auth/login' : '/api/auth/register'
      const body = currentMode === 'login'
        ? { phone, password }
        : { phone, password, name, email }

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

      if (currentMode === 'register') {
        toast.success('Conta criada com sucesso! Bem-vindo!')
        setTimeout(() => {
          router.push('/dashboard')
          router.refresh()
        }, 500)
      } else {
        // Login normal: redirecionar baseado no tipo de usuário
        toast.success('Login realizado com sucesso!')
        if (data.dailyUser) {
          if (data.dailyUser.is_admin) {
            setTimeout(() => {
              router.push('/dashboard')
              router.refresh()
            }, 500)
          } else {
            // Usuário comum: redirecionar para seu próprio dashboard
            setTimeout(() => {
              router.push('/dashboard')
              router.refresh()
            }, 500)
          }
        } else {
          // Fallback: middleware irá decidir
          setTimeout(() => {
            router.push('/dashboard')
            router.refresh()
          }, 500)
        }
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar solicitação'
      setError(errorMessage)
      toast.error(errorMessage)
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
      {/* Banner de Trial na tela de cadastro */}
      {currentMode === 'register' && (
        <div className="mb-6 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 to-emerald-600/10 border border-emerald-500/20">
          <div className="flex items-center gap-3 mb-2">
            <div className="bg-emerald-500/20 p-2 rounded-lg">
              <Gift className="w-5 h-5 text-emerald-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-white font-semibold text-sm mb-1">
                ✨ 7 dias grátis para testar
              </h3>
              <p className="text-slate-400 text-xs">
                Sem cartão de crédito • Cancele quando quiser
              </p>
            </div>
          </div>
        </div>
      )}

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
              <div className="relative">
                <Input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={() => setNameTouched(true)}
                  placeholder="Seu nome completo"
                  disabled={loading}
                  className={nameTouched && !isNameValid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
                />
                {nameTouched && (
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {isNameValid ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : name.length > 0 ? (
                      <X className="w-5 h-5 text-red-500" />
                    ) : null}
                  </div>
                )}
              </div>
              {nameTouched && !isNameValid && name.length > 0 && (
                <p className="text-xs text-red-400 mt-1">Nome deve ter pelo menos 2 caracteres</p>
              )}
            </div>

            <div>
              <label htmlFor="email-register" className="block text-sm font-medium text-slate-300 mb-1">
                Email (opcional)
              </label>
              <Input
                type="email"
                id="email-register"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="seu@email.com"
                leftIcon={Mail}
                disabled={loading}
              />
            </div>
          </>
        )}

        <div>
          <label htmlFor="phone" className="block text-sm font-medium text-slate-300 mb-1">
            Telefone
          </label>
          <div className="relative">
            <Input
              type="tel"
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              onBlur={() => setPhoneTouched(true)}
              placeholder="+55 11 99999-9999"
              leftIcon={Phone}
              required
              disabled={loading}
              className={phoneTouched && !isPhoneValid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            />
            {phoneTouched && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isPhoneValid && phone.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : phone.length > 0 ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : null}
              </div>
            )}
          </div>
          {phoneTouched && !isPhoneValid && phone.length > 0 && (
            <p className="text-xs text-red-400 mt-1">Telefone inválido</p>
          )}
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
            Senha
          </label>
          <div className="relative">
            <Input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setPasswordTouched(true)}
              placeholder="••••••••"
              leftIcon={Lock}
              required
              minLength={6}
              disabled={loading}
              className={passwordTouched && !isPasswordValid ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            />
            {passwordTouched && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {isPasswordValid && password.length > 0 ? (
                  <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                ) : password.length > 0 ? (
                  <X className="w-5 h-5 text-red-500" />
                ) : null}
              </div>
            )}
          </div>
          {currentMode === 'register' && (
            <p className={`text-xs mt-1 ${passwordTouched && !isPasswordValid && password.length > 0 ? 'text-red-400' : 'text-slate-500'}`}>
              Mínimo de 6 caracteres
            </p>
          )}
          {passwordTouched && !isPasswordValid && password.length > 0 && (
            <p className="text-xs text-red-400 mt-1">Senha deve ter pelo menos 6 caracteres</p>
          )}
          {currentMode === 'login' && (
            <div className="mt-2 text-right">
              <a
                href="/forgot-password"
                className="text-sm text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
              >
                Esqueceu sua senha?
              </a>
            </div>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || (currentMode === 'register' && (!isPhoneValid || !isPasswordValid || !isNameValid))}
          loading={loading}
          icon={currentMode === 'login' ? LogIn : UserPlus}
        >
          {currentMode === 'login' ? 'Entrar' : 'Criar conta grátis'}
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
