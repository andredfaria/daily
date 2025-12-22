'use client'

import { CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface SuccessMessageProps {
  userId?: number
  onReset?: () => void
}

export default function SuccessMessage({ userId, onReset }: SuccessMessageProps) {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 mb-6">
      <div className="flex items-start gap-4">
        <div className="bg-green-50 p-3 rounded-lg">
          <CheckCircle className="text-green-600 w-6 h-6" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-green-900 mb-1">Usuário criado com sucesso!</h3>
          <p className="text-sm text-green-700 mb-4">O usuário foi cadastrado no sistema.</p>
          <div className="flex gap-3">
            {userId && (
              <Link
                href={`/?id=${userId}`}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
              >
                Ver Dashboard
              </Link>
            )}
            <button
              onClick={onReset}
              className="px-4 py-2 bg-slate-100 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-200 transition-colors"
            >
              Criar Outro
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
