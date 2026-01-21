'use client'

import { useState, FormEvent, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, CheckCircle2 } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'
import Alert from './ui/Alert'
import { useToast } from './ToastProvider'
import { supabase } from '@/lib/supabase'

export default function ResetPasswordForm() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [confirmPasswordTouched, setConfirmPasswordTouched] = useState(false)
  const toast = useToast()

  // Verificar se há token válido na URL
  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get('access_token')
    const type = hashParams.get('type')

    if (!accessToken || type !== 'recovery') {
      // Token inválido ou ausente
      setError('Link inválido ou expirado. Solicite um novo link de recuperação.')
    }
  }, [])

  const isPasswordValid = password.length === 0 || password.length >= 6
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Validações
    if (password.length < 6) {
      setError('A senha deve ter no mínimo 6 caracteres')
      toast.error('A senha deve ter no mínimo 6 caracteres')
      return
    }

    if (password !== confirmPassword) {
      setError('As senhas não coincidem')
      toast.error('As senhas não coincidem')
      return
    }

    setLoading(true)

    try {
      // Obter token da URL hash
      const hashParams = new URLSearchParams(window.location.hash.substring(1))
      const accessToken = hashParams.get('access_token')

      if (!accessToken) {
        throw new Error('Token de recuperação inválido ou expirado')
      }

      // Atualizar senha usando o token
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      })

      if (updateError) {
        throw updateError
      }

      setSuccess(true)
      toast.success('Senha redefinida com sucesso! Redirecionando para login...')

      // Redirecionar para login após 2 segundos
      setTimeout(() => {
        router.push('/login')
      }, 2000)
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao redefinir senha'
      setError(errorMessage)
      toast.error(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="w-full max-w-md mx-auto" variant="glass">
        <div className="text-center p-6">
          <div className="bg-emerald-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-emerald-500 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Senha redefinida!</h2>
          <p className="text-slate-400 mb-4">
            Sua senha foi alterada com sucesso. Você será redirecionado para a página de login.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto" variant="glass">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Nova senha</h2>
        <p className="text-slate-400 text-sm">
          Digite sua nova senha abaixo
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-slate-300 mb-1">
            Nova senha
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
            {passwordTouched && isPasswordValid && password.length > 0 && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">Mínimo de 6 caracteres</p>
          {passwordTouched && !isPasswordValid && password.length > 0 && (
            <p className="text-xs text-red-400 mt-1">Senha deve ter pelo menos 6 caracteres</p>
          )}
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-slate-300 mb-1">
            Confirmar senha
          </label>
          <div className="relative">
            <Input
              type="password"
              id="confirmPassword"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onBlur={() => setConfirmPasswordTouched(true)}
              placeholder="••••••••"
              leftIcon={Lock}
              required
              disabled={loading}
              className={confirmPasswordTouched && !passwordsMatch ? 'border-red-500 focus:border-red-500 focus:ring-red-500/20' : ''}
            />
            {confirmPasswordTouched && passwordsMatch && confirmPassword.length > 0 && (
              <CheckCircle2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-500" />
            )}
          </div>
          {confirmPasswordTouched && !passwordsMatch && confirmPassword.length > 0 && (
            <p className="text-xs text-red-400 mt-1">As senhas não coincidem</p>
          )}
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || !isPasswordValid || !passwordsMatch || password.length === 0 || confirmPassword.length === 0}
          loading={loading}
          icon={Lock}
        >
          Redefinir senha
        </Button>
      </form>
    </Card>
  )
}
