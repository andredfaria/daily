import { AlertCircle } from 'lucide-react'
import Link from 'next/link'

interface ErrorMessageProps {
  title?: string
  message: string
  showCreateButton?: boolean
}

export default function ErrorMessage({ 
  title = 'Erro', 
  message, 
  showCreateButton = false 
}: ErrorMessageProps) {
  return (
    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-red-100">
      <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
        <AlertCircle className="text-red-500 w-8 h-8" />
      </div>
      <h2 className="text-xl font-bold text-slate-900">{title}</h2>
      <p className="text-slate-500 mt-2 mb-6">{message}</p>
      {showCreateButton && (
        <Link
          href="/create"
          className="inline-flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 transition-colors"
        >
          Criar Novo Usuário
        </Link>
      )}
    </div>
  )
}
