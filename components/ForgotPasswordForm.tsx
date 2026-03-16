'use client'

import { useState, FormEvent, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowRight, MessageCircle, RefreshCw, CheckCircle2, ShieldCheck } from 'lucide-react'
import Button from './ui/Button'
import Card from './ui/Card'
import PhoneInput from './ui/PhoneInput'
import Alert from './ui/Alert'
import { useToast } from '@/components/ToastProvider'

type Step = 'phone' | 'otp' | 'success'

export default function ForgotPasswordForm() {
  const router = useRouter()
  const toast = useToast()

  const [step, setStep] = useState<Step>('phone')
  const [ddd, setDdd] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [validatedPhone, setValidatedPhone] = useState('')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resendCooldown, setResendCooldown] = useState(0)

  const otpRefs = useRef<(HTMLInputElement | null)[]>([])

  const getFullPhone = () => `+55${ddd}${phoneNumber}`
  const isPhoneReady = ddd.length === 2 && phoneNumber.replace(/\D/g, '').length >= 8

  // ── Passo 1: Enviar OTP ──────────────────────────────────────

  const handleSendOTP = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!isPhoneReady) {
      setError('Selecione o DDD e digite um número válido')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getFullPhone() }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Erro ao enviar código')
      }

      setValidatedPhone(data.phone || getFullPhone())
      setStep('otp')
      toast.success('Código enviado para o seu WhatsApp!')
      startResendCooldown()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao processar solicitação'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Passo 2: Verificar OTP ───────────────────────────────────

  const handleVerifyOTP = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const otpCode = otp.join('')
    if (otpCode.length < 6) {
      setError('Digite todos os 6 dígitos do código')
      return
    }

    setLoading(true)

    try {
      const response = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getFullPhone(), otp: otpCode }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Código inválido')
      }

      // Redireciona para reset-password com o token
      setStep('success')
      toast.success('Código verificado! Redirecionando...')
      setTimeout(() => {
        router.push(`/reset-password?token=${data.resetToken}`)
      }, 1000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao verificar código'
      setError(msg)
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  // ── Reenviar OTP ─────────────────────────────────────────────

  const handleResend = async () => {
    if (resendCooldown > 0) return
    setError(null)
    setLoading(true)
    setOtp(['', '', '', '', '', ''])

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: getFullPhone() }),
      })

      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Erro ao reenviar código')

      toast.success('Novo código enviado para o seu WhatsApp!')
      startResendCooldown()
      otpRefs.current[0]?.focus()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Erro ao reenviar'
      setError(msg)
    } finally {
      setLoading(false)
    }
  }

  const startResendCooldown = () => {
    setResendCooldown(60)
    const interval = setInterval(() => {
      setResendCooldown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0 }
        return prev - 1
      })
    }, 1000)
  }

  // ── OTP input handlers ───────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    if (value && index < 5) otpRefs.current[index + 1]?.focus()
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      setOtp(pasted.split(''))
      otpRefs.current[5]?.focus()
    }
  }

  // ── Sucesso ──────────────────────────────────────────────────

  if (step === 'success') {
    return (
      <Card className="w-full max-w-md mx-auto" variant="glass">
        <div className="text-center p-6">
          <div className="bg-emerald-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="text-emerald-500 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Código verificado!</h2>
          <p className="text-slate-400">Redirecionando para criar nova senha...</p>
        </div>
      </Card>
    )
  }

  // ── Passo 1: Telefone ────────────────────────────────────────

  if (step === 'phone') {
    return (
      <Card className="w-full max-w-md mx-auto" variant="glass">
        <div className="text-center mb-6">
          <div className="bg-slate-800 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageCircle className="text-emerald-500 w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Recuperar via WhatsApp</h2>
          <p className="text-slate-400 text-sm">
            Informe seu número de WhatsApp e enviaremos um código de verificação
          </p>
        </div>

        {error && (
          <Alert variant="error" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSendOTP} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Número de WhatsApp
            </label>
            <PhoneInput
              ddd={ddd}
              number={phoneNumber}
              onDDDChange={setDdd}
              onNumberChange={setPhoneNumber}
              disabled={loading}
              autoFocus
            />
            <p className="text-xs text-slate-500 mt-1.5">
              Use o mesmo número cadastrado na sua conta
            </p>
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={loading || !isPhoneReady}
            loading={loading}
            icon={ArrowRight}
          >
            Enviar código pelo WhatsApp
          </Button>
        </form>
      </Card>
    )
  }

  // ── Passo 2: OTP ─────────────────────────────────────────────

  return (
    <Card className="w-full max-w-md mx-auto" variant="glass">
      <div className="text-center mb-6">
        <div className="bg-emerald-500/10 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
          <ShieldCheck className="text-emerald-500 w-8 h-8" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Digite o código</h2>
        <p className="text-slate-400 text-sm">
          Enviamos um código de 6 dígitos para
        </p>
        <p className="text-emerald-400 font-medium mt-1">
          WhatsApp: {validatedPhone || getFullPhone()}
        </p>
      </div>

      {error && (
        <Alert variant="error" className="mb-4">
          {error}
        </Alert>
      )}

      <form onSubmit={handleVerifyOTP} className="space-y-6">
        {/* OTP inputs */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-3 text-center">
            Código de verificação
          </label>
          <div
            className="flex gap-2 justify-center"
            onPaste={handleOtpPaste}
          >
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(el) => { otpRefs.current[index] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleOtpChange(index, e.target.value)}
                onKeyDown={(e) => handleOtpKeyDown(index, e)}
                disabled={loading}
                className="w-11 h-14 text-center text-2xl font-bold rounded-xl bg-slate-800 border border-slate-700 text-white
                  focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500
                  disabled:opacity-50 transition-all"
              />
            ))}
          </div>
          <p className="text-xs text-slate-500 mt-3 text-center">
            Código válido por 15 minutos
          </p>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={loading || otp.join('').length < 6}
          loading={loading}
          icon={ShieldCheck}
        >
          Verificar código
        </Button>
      </form>

      {/* Reenviar */}
      <div className="mt-4 text-center">
        <button
          type="button"
          onClick={handleResend}
          disabled={resendCooldown > 0 || loading}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-emerald-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className="w-4 h-4" />
          {resendCooldown > 0
            ? `Reenviar em ${resendCooldown}s`
            : 'Não recebi o código — reenviar'}
        </button>
      </div>

      {/* Voltar */}
      <div className="mt-2 text-center">
        <button
          type="button"
          onClick={() => { setStep('phone'); setError(null); setOtp(['', '', '', '', '', '']); setPhoneNumber('') }}
          className="text-sm text-slate-500 hover:text-slate-300 transition-colors"
        >
          Alterar número
        </button>
      </div>
    </Card>
  )
}
