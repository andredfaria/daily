import LoginForm from '@/components/LoginForm'
import { Activity } from 'lucide-react'

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex flex-col items-center justify-center px-4 py-8">
      {/* Logo/Header */}
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="bg-indigo-600 p-3 rounded-xl shadow-lg">
            <Activity className="text-white w-8 h-8" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            Daily<span className="text-indigo-600">Sync</span>
          </h1>
        </div>
        <p className="text-slate-600">Sistema de Gestão de Atividades Diárias</p>
      </div>

      {/* Login Form */}
      <LoginForm />

      {/* Footer */}
      <div className="mt-8 text-center text-sm text-slate-500">
        <p>Dashboard e status diário</p>
      </div>
    </div>
  )
}
