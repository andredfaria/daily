import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { requestOtp, verifyOtp } from '../api/auth'
import { useAuth } from '../context/AuthContext'

type Step = 'phone' | 'otp'

const RESEND_COOLDOWN = 60

export const Login: React.FC = () => {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [step, setStep] = useState<Step>('phone')
  const [phone, setPhone] = useState('')
  const [digits, setDigits] = useState<string[]>(Array(6).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cooldown, setCooldown] = useState(0)

  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // countdown timer
  useEffect(() => {
    if (cooldown <= 0) return
    const id = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(id)
  }, [cooldown])

  const formatPhone = (val: string) => {
    const d = val.replace(/\D/g, '').slice(0, 11)
    if (d.length <= 2) return d
    if (d.length <= 7) return `(${d.slice(0, 2)}) ${d.slice(2)}`
    return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  }

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPhone(formatPhone(e.target.value))
    setError(null)
  }

  const getDigitsOnly = (formatted: string) => formatted.replace(/\D/g, '')

  const handleRequestOtp = useCallback(async () => {
    const raw = getDigitsOnly(phone)
    if (raw.length < 10) {
      setError('Número inválido. Use o formato (XX) XXXXX-XXXX')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await requestOtp(`55${raw}`)
      setStep('otp')
      setCooldown(RESEND_COOLDOWN)
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Erro ao enviar código. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }, [phone])

  const handleOtpInput = (index: number, value: string) => {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...digits]
    next[index] = char
    setDigits(next)
    setError(null)
    if (char && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
  }

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6)
    if (pasted.length === 6) {
      e.preventDefault()
      setDigits(pasted.split(''))
      inputRefs.current[5]?.focus()
    }
  }

  const handleVerifyOtp = useCallback(async () => {
    const code = digits.join('')
    if (code.length < 6) {
      setError('Digite todos os 6 dígitos do código')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const raw = getDigitsOnly(phone)
      const { data } = await verifyOtp(`55${raw}`, code)
      login(data.token, data.user)
      navigate('/', { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Código inválido. Tente novamente.')
      setDigits(Array(6).fill(''))
      setTimeout(() => inputRefs.current[0]?.focus(), 50)
    } finally {
      setLoading(false)
    }
  }, [digits, phone, login, navigate])

  // submit on Enter
  const handlePhoneKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleRequestOtp()
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-container-high mb-4">
            <span className="material-symbols-outlined text-primary text-3xl">account_balance_wallet</span>
          </div>
          <h1 className="text-2xl font-semibold text-on-surface">BillSync</h1>
          <p className="text-sm text-on-surface-variant mt-1">Gestão de contas pessoais</p>
        </div>

        {/* Card */}
        <div className="bg-surface-container rounded-3xl p-6 shadow-xl">
          {step === 'phone' ? (
            <>
              <h2 className="text-lg font-medium text-on-surface mb-1">Entrar</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Digite seu número do WhatsApp para receber o código de acesso.
              </p>

              <div className="mb-4">
                <label className="block text-xs font-medium text-on-surface-variant mb-2">
                  Número de telefone
                </label>
                <div className="flex items-center gap-2 bg-surface-container-high rounded-xl px-4 py-3 border border-outline-variant focus-within:border-primary transition-colors">
                  <span className="text-on-surface-variant text-sm font-medium shrink-0">+55</span>
                  <input
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    onKeyDown={handlePhoneKeyDown}
                    placeholder="(11) 99999-9999"
                    className="bg-transparent flex-1 text-on-surface placeholder-on-surface-variant text-sm outline-none"
                    autoComplete="tel"
                    autoFocus
                  />
                </div>
              </div>

              {error && (
                <p className="text-error text-xs mb-4">{error}</p>
              )}

              <button
                onClick={handleRequestOtp}
                disabled={loading}
                className="w-full bg-primary text-on-primary font-medium py-3 rounded-xl hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {loading ? 'Enviando...' : 'Enviar código via WhatsApp'}
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => { setStep('phone'); setError(null); setDigits(Array(6).fill('')) }}
                className="flex items-center gap-1 text-on-surface-variant text-sm mb-4 hover:text-on-surface transition-colors"
              >
                <span className="material-symbols-outlined text-base">arrow_back</span>
                Voltar
              </button>

              <h2 className="text-lg font-medium text-on-surface mb-1">Código de verificação</h2>
              <p className="text-sm text-on-surface-variant mb-6">
                Enviamos um código para <span className="text-on-surface font-medium">+55 {phone}</span> via WhatsApp.
              </p>

              {/* 6 digit inputs */}
              <div className="flex gap-2 justify-center mb-6" onPaste={handleOtpPaste}>
                {digits.map((d, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el }}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={d}
                    autoComplete={i === 0 ? 'one-time-code' : 'off'}
                    onChange={(e) => handleOtpInput(i, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(i, e)}
                    className="w-11 h-14 text-center text-xl font-bold text-on-surface bg-surface-container-high border border-outline-variant rounded-xl focus:border-primary focus:outline-none transition-colors"
                  />
                ))}
              </div>

              {error && (
                <p className="text-error text-xs mb-4 text-center">{error}</p>
              )}

              <button
                onClick={handleVerifyOtp}
                disabled={loading || digits.join('').length < 6}
                className="w-full bg-primary text-on-primary font-medium py-3 rounded-xl hover:opacity-90 active:opacity-80 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed text-sm mb-3"
              >
                {loading ? 'Verificando...' : 'Verificar código'}
              </button>

              <div className="text-center">
                {cooldown > 0 ? (
                  <p className="text-on-surface-variant text-xs">
                    Reenviar código em <span className="text-on-surface font-medium">{cooldown}s</span>
                  </p>
                ) : (
                  <button
                    onClick={handleRequestOtp}
                    disabled={loading}
                    className="text-primary text-xs hover:underline disabled:opacity-50"
                  >
                    Reenviar código
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default Login
