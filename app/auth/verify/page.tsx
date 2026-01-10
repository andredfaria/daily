'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Activity, CheckCircle, XCircle, Loader2 } from 'lucide-react'
import Card from '@/components/ui/Card'
import Button from '@/components/ui/Button'

export default function VerifyEmailPage() {
    const router = useRouter()
    const searchParams = useSearchParams()
    const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
    const [message, setMessage] = useState('')

    useEffect(() => {
        const verifyEmail = async () => {
            try {
                const token = searchParams.get('token')
                const type = searchParams.get('type')

                if (!token || type !== 'signup') {
                    setStatus('error')
                    setMessage('Link de verificação inválido.')
                    return
                }

                // Chamar a API para confirmar o email
                const response = await fetch('/api/auth/verify', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ token, type }),
                })

                const data = await response.json()

                if (!response.ok) {
                    throw new Error(data.error || 'Erro ao verificar email')
                }

                setStatus('success')
                setMessage('Email verificado com sucesso! Você será redirecionado para o login.')

                // Redirecionar para login após 3 segundos
                setTimeout(() => {
                    router.push('/login')
                }, 3000)
            } catch (err: unknown) {
                setStatus('error')
                setMessage(err instanceof Error ? err.message : 'Erro ao verificar email')
            }
        }

        verifyEmail()
    }, [searchParams, router])

    const handleGoToLogin = () => {
        router.push('/login')
    }

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4 py-8 relative overflow-hidden">
            {/* Background Decor */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[500px] bg-emerald-500/10 blur-[120px] rounded-full opacity-50 pointer-events-none" />

            {/* Logo/Header */}
            <div className="mb-8 text-center relative z-10">
                <div className="flex items-center justify-center gap-3 mb-4">
                    <div className="bg-emerald-500 p-3 rounded-xl shadow-lg shadow-emerald-500/20">
                        <Activity className="text-white w-8 h-8" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">
                        Daily<span className="text-emerald-500">Sync</span>
                    </h1>
                </div>
                <p className="text-slate-400">Verificação de Email</p>
            </div>

            {/* Verification Card */}
            <Card className="w-full max-w-md mx-auto" variant="glass">
                <div className="text-center">
                    {/* Status Icon */}
                    <div className="mb-6">
                        {status === 'loading' && (
                            <div className="bg-slate-800 w-20 h-20 rounded-full flex items-center justify-center mx-auto animate-pulse">
                                <Loader2 className="text-emerald-500 w-10 h-10 animate-spin" />
                            </div>
                        )}
                        {status === 'success' && (
                            <div className="bg-emerald-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                <CheckCircle className="text-emerald-500 w-10 h-10" />
                            </div>
                        )}
                        {status === 'error' && (
                            <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto">
                                <XCircle className="text-red-500 w-10 h-10" />
                            </div>
                        )}
                    </div>

                    {/* Status Title */}
                    <h2 className="text-2xl font-bold text-white mb-3">
                        {status === 'loading' && 'Verificando seu email...'}
                        {status === 'success' && 'Email Verificado!'}
                        {status === 'error' && 'Erro na Verificação'}
                    </h2>

                    {/* Status Message */}
                    <p className="text-slate-400 mb-6">
                        {message || 'Aguarde enquanto verificamos seu email.'}
                    </p>

                    {/* Action Button */}
                    {status === 'error' && (
                        <Button
                            onClick={handleGoToLogin}
                            className="w-full"
                            variant="primary"
                        >
                            Ir para Login
                        </Button>
                    )}

                    {status === 'success' && (
                        <div className="text-sm text-slate-500">
                            Redirecionando automaticamente em 3 segundos...
                        </div>
                    )}
                </div>
            </Card>

            {/* Footer */}
            <div className="mt-8 text-center text-sm text-slate-500">
                <p>Sistema de Gestão de Atividades Diárias</p>
            </div>
        </div>
    )
}
