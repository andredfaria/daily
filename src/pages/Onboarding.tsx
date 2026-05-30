import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import client from '../api/client'
import { wahaApi } from '../api/waha'

type Step = 0 | 1 | 2 | 3

const CATEGORIES: { value: string; label: string }[] = [
  { value: 'moradia', label: 'Moradia' },
  { value: 'assinaturas', label: 'Assinaturas' },
  { value: 'serviços', label: 'Serviços' },
  { value: 'saúde', label: 'Saúde' },
  { value: 'educação', label: 'Educação' },
  { value: 'transporte', label: 'Transporte' },
  { value: 'alimentação', label: 'Alimentação' },
  { value: 'outro', label: 'Outro' },
]

const Onboarding: React.FC = () => {
  const navigate = useNavigate()
  const { refreshUser } = useAuth()

  const [step, setStep] = useState<Step>(0)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Passo 1 — primeira conta
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [dayOfMonth, setDayOfMonth] = useState('')
  const [category, setCategory] = useState('moradia')
  const [billCreated, setBillCreated] = useState(false)

  // Passo 2 — WhatsApp
  const [waStatus, setWaStatus] = useState<'loading' | 'connected' | 'disconnected'>('loading')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)

  useEffect(() => {
    if (step !== 2) return
    setWaStatus('loading')
    wahaApi
      .getStatus()
      .then((s) => setWaStatus(s.connected ? 'connected' : 'disconnected'))
      .catch(() => setWaStatus('disconnected'))
  }, [step])

  const finish = async () => {
    setSaving(true)
    setError('')
    try {
      await client.patch('/users/me', { onboarding_completed: true })
      await refreshUser()
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao concluir')
      setSaving(false)
    }
  }

  const handleCreateBill = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    const value = Number(amount.replace(',', '.'))
    const day = Number(dayOfMonth)
    if (!name.trim()) return setError('Informe o nome da conta')
    if (isNaN(value) || value < 0) return setError('Informe um valor válido')
    if (isNaN(day) || day < 1 || day > 31) return setError('Dia de vencimento entre 1 e 31')

    setSaving(true)
    try {
      await client.post('/bills', {
        name: name.trim(),
        category,
        amount: value,
        recurrence_type: 'monthly',
        recurrence_day_of_month: day,
        is_active: true,
      })
      setBillCreated(true)
      setStep(2)
    } catch (err: any) {
      setError(err.response?.data?.error || 'Erro ao criar conta')
    } finally {
      setSaving(false)
    }
  }

  const handleTest = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const res = await wahaApi.sendTest()
      setTestResult(
        res.ok
          ? '✅ Mensagem de teste enviada! Confira seu WhatsApp.'
          : res.error || 'Falha no envio',
      )
    } catch (err: any) {
      setTestResult(err.response?.data?.error || 'Falha ao enviar teste')
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-surface-container-high mb-4">
            <span className="material-symbols-outlined text-primary text-3xl">account_balance_wallet</span>
          </div>
          <h1 className="text-2xl font-semibold text-on-surface">Bem-vindo ao BillSync</h1>
        </div>

        {/* Indicador de passos */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                step >= s ? 'bg-primary w-8' : 'bg-outline-variant w-4'
              }`}
            />
          ))}
        </div>

        <div className="bg-surface-container rounded-3xl p-6 shadow-xl">
          {error && (
            <div className="mb-4 p-3 rounded-xl bg-error/10 text-error text-sm">{error}</div>
          )}

          {/* Passo 0 — boas-vindas */}
          {step === 0 && (
            <div className="space-y-5 text-center">
              <p className="text-on-surface-variant text-sm">
                Vamos configurar sua conta em 3 passos rápidos: cadastrar sua primeira conta,
                conferir o WhatsApp e testar um lembrete.
              </p>
              <button
                onClick={() => setStep(1)}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors"
              >
                Começar
              </button>
              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
              >
                Pular configuração
              </button>
            </div>
          )}

          {/* Passo 1 — primeira conta */}
          {step === 1 && (
            <form onSubmit={handleCreateBill} className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary">receipt_long</span>
                <h2 className="text-lg font-medium text-on-surface">Sua primeira conta</h2>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-2">Nome</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Aluguel, Netflix, Energia"
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant focus:border-primary focus:outline-none text-on-surface text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">Valor (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0,00"
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant focus:border-primary focus:outline-none text-on-surface text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-on-surface-variant mb-2">Vence dia</label>
                  <input
                    type="number"
                    min={1}
                    max={31}
                    value={dayOfMonth}
                    onChange={(e) => setDayOfMonth(e.target.value)}
                    placeholder="10"
                    className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant focus:border-primary focus:outline-none text-on-surface text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-on-surface-variant mb-2">Categoria</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl bg-surface-container-high border border-outline-variant focus:border-primary focus:outline-none text-on-surface text-sm"
                >
                  {CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>
              <p className="text-xs text-on-surface-variant">Recorrência mensal. Você poderá ajustar depois.</p>
              <button
                type="submit"
                disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Criar e continuar'}
              </button>
            </form>
          )}

          {/* Passo 2 — WhatsApp */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-1">
                <span className="material-symbols-outlined text-primary">chat</span>
                <h2 className="text-lg font-medium text-on-surface">Seu WhatsApp</h2>
              </div>
              {billCreated && (
                <div className="p-3 rounded-xl bg-tertiary/10 text-tertiary text-sm">
                  ✅ Primeira conta cadastrada!
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <span
                  className={`w-2.5 h-2.5 rounded-full ${
                    waStatus === 'connected'
                      ? 'bg-tertiary'
                      : waStatus === 'disconnected'
                      ? 'bg-error'
                      : 'bg-yellow-400 animate-pulse'
                  }`}
                />
                <span className="text-on-surface-variant">
                  {waStatus === 'loading' && 'Verificando conexão...'}
                  {waStatus === 'connected' && 'WhatsApp conectado'}
                  {waStatus === 'disconnected' && 'WhatsApp desconectado'}
                </span>
              </div>
              <p className="text-sm text-on-surface-variant">
                Os lembretes chegam no número usado no login. Envie um teste para confirmar que
                tudo está funcionando.
              </p>
              <button
                onClick={handleTest}
                disabled={testing || waStatus !== 'connected'}
                className="w-full py-3 rounded-xl bg-surface-container-high border border-outline-variant text-on-surface font-semibold hover:bg-surface-container-highest transition-colors disabled:opacity-50"
              >
                {testing ? 'Enviando teste...' : 'Enviar mensagem de teste'}
              </button>
              {testResult && (
                <div className="p-3 rounded-xl bg-surface-container-high text-sm text-on-surface-variant">
                  {testResult}
                </div>
              )}
              <button
                onClick={() => setStep(3)}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors"
              >
                Continuar
              </button>
            </div>
          )}

          {/* Passo 3 — conclusão */}
          {step === 3 && (
            <div className="space-y-5 text-center">
              <div className="w-16 h-16 mx-auto rounded-full bg-tertiary/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-tertiary text-3xl">check_circle</span>
              </div>
              <div>
                <h2 className="text-lg font-medium text-on-surface mb-1">Tudo pronto!</h2>
                <p className="text-on-surface-variant text-sm">
                  Você já pode acompanhar suas contas e receber lembretes no WhatsApp.
                </p>
              </div>
              <button
                onClick={finish}
                disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-on-primary font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {saving ? 'Finalizando...' : 'Ir para o painel'}
              </button>
            </div>
          )}
        </div>

        {step > 0 && step < 3 && (
          <button
            onClick={finish}
            disabled={saving}
            className="w-full mt-4 py-2 text-sm text-on-surface-variant hover:text-on-surface transition-colors disabled:opacity-50"
          >
            Pular configuração
          </button>
        )}
      </div>
    </div>
  )
}

export default Onboarding
