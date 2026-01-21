'use client'

import { useAuth } from './AuthProvider'
import { getDaysRemaining } from '@/lib/utils/subscription'
import { AlertCircle, Clock } from 'lucide-react'
import Alert from './ui/Alert'
import Button from './ui/Button'
import Link from 'next/link'

export default function TrialBanner() {
  const { dailyUser } = useAuth()

  if (!dailyUser || dailyUser.is_admin) {
    return null
  }

  // Verificar se está em trial
  if (dailyUser.subscription_status !== 'trial') {
    return null
  }

  const daysRemaining = getDaysRemaining(dailyUser)

  // Não mostrar se trial já expirou
  if (daysRemaining <= 0) {
    return (
      <Alert variant="error" className="mb-6">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-start gap-3 flex-1">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold mb-1">Período de teste expirado</h4>
              <p className="text-sm opacity-90">
                Seu período de teste gratuito expirou. Ative sua assinatura para continuar usando o sistema.
              </p>
            </div>
          </div>
          <Link href="/subscription">
            <Button size="sm" className="ml-4">
              Ativar Assinatura
            </Button>
          </Link>
        </div>
      </Alert>
    )
  }

  // Determinar variante baseado nos dias restantes
  let variant: 'info' | 'warning' | 'error' = 'info'
  let urgencyText = ''

  if (daysRemaining <= 2) {
    variant = 'error'
    urgencyText = 'Seu período de teste expira em breve!'
  } else if (daysRemaining <= 5) {
    variant = 'warning'
    urgencyText = 'Seu período de teste está próximo de expirar.'
  } else {
    variant = 'info'
  }

  return (
    <Alert variant={variant} className="mb-6">
      <div className="flex items-center justify-between w-full">
        <div className="flex items-start gap-3 flex-1">
          <Clock className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="font-semibold mb-1">
              {urgencyText || 'Período de teste ativo'}
            </h4>
            <p className="text-sm opacity-90">
              Você tem <strong>{daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}</strong> restantes no seu trial gratuito.
              {daysRemaining <= 5 && ' Ative sua assinatura para não perder o acesso.'}
            </p>
          </div>
        </div>
        <Link href="/subscription">
          <Button size="sm" className="ml-4">
            Assinar Agora
          </Button>
        </Link>
      </div>
    </Alert>
  )
}
