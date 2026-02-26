'use client'

import { useState, FormEvent } from 'react'
import { Mail, ArrowRight } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import Input from './ui/Input'
import Alert from './ui/Alert'
import { useToast } from '@/components/ToastProvider'

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar email')
      }

      setSuccess(true)
      toast.success('Email de recuperação enviado! Verifique sua caixa de entrada.')
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Erro ao processar solicitação'
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
            <Mail className="text-emerald-500 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Email enviado!</h2>
          <p className="text-slate-400 mb-4">
            Se o email <strong className="text-white">{email}</strong> existir em nossa base, você receberá um link para redefinir sua senha.
          </p>
          <p className="text-sm text-slate-500">
            Não recebeu o email? Verifique sua pasta de spam ou tente novamente.
          </p>
        </div>
      </Card>
    )
  }

  return (
    <Card className="w-full max-w-md mx-auto" variant="glass">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold text-white mb-2">Esqueceu sua senha?</h2>
        <p className="text-slate-400 text-sm">
          Digite seu email e enviaremos um link para redefinir sua senha
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
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

        <Button
          type="submit"
          className="w-full"
          disabled={loading}
          loading={loading}
          icon={ArrowRight}
        >
          Enviar link de recuperação
        </Button>
      </form>
    </Card>
  )
}
