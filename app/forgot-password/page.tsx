import { Activity, ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import ForgotPasswordForm from '@/components/ForgotPasswordForm'

export default function ForgotPasswordPage() {
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
        <p className="text-slate-400">Recuperar senha</p>
      </div>

      {/* Forgot Password Form */}
      <ForgotPasswordForm />

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link
          href="/login"
          className="text-sm text-slate-400 hover:text-emerald-400 transition-colors inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Voltar para login
        </Link>
      </div>
    </div>
  )
}
