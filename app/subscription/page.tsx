import { Suspense } from 'react'
import Navbar from '@/components/Navbar'
import SubscriptionPlans from '@/components/SubscriptionPlans'
import { getCurrentDailyUser } from '@/lib/server-auth'
import { getDaysRemaining } from '@/lib/utils/subscription-utils'
import Card from '@/components/ui/Card'
import Skeleton from '@/components/ui/Skeleton'

async function SubscriptionContent() {
  const dailyUser = await getCurrentDailyUser()

  if (!dailyUser) {
    return (
      <div className="max-w-4xl mx-auto">
        <Card>
          <p className="text-center text-slate-400">
            Você precisa estar logado para visualizar os planos.
          </p>
        </Card>
      </div>
    )
  }

  const daysRemaining = getDaysRemaining(dailyUser)

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Status da Assinatura */}
      <Card variant="glass">
        <div className="p-6">
          <h2 className="text-xl font-bold text-white mb-4">Status da Assinatura</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-slate-400 mb-1">Status Atual</p>
              <p className="text-lg font-semibold text-white capitalize">
                {dailyUser.subscription_status || 'trial'}
              </p>
            </div>
            {dailyUser.subscription_status === 'trial' && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Dias Restantes</p>
                <p className="text-lg font-semibold text-emerald-400">
                  {daysRemaining} {daysRemaining === 1 ? 'dia' : 'dias'}
                </p>
              </div>
            )}
            {dailyUser.subscription_status === 'active' && dailyUser.subscription_ends_at && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Próxima Renovação</p>
                <p className="text-lg font-semibold text-white">
                  {new Date(dailyUser.subscription_ends_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            )}
            {dailyUser.subscription_plan && (
              <div>
                <p className="text-sm text-slate-400 mb-1">Plano</p>
                <p className="text-lg font-semibold text-white capitalize">
                  {dailyUser.subscription_plan}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Planos de Assinatura */}
      <SubscriptionPlans />
    </div>
  )
}

export default function SubscriptionPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar title="Assinatura" showBack />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <Suspense
          fallback={
            <div className="space-y-6">
              <Skeleton variant="rectangular" height={150} />
              <Skeleton variant="rectangular" height={400} />
            </div>
          }
        >
          <SubscriptionContent />
        </Suspense>
      </main>
    </div>
  )
}
