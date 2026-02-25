import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import Navbar from '@/components/Navbar'
import DashboardContent from '@/components/DashboardContent'
import DashboardSkeleton from '@/components/DashboardSkeleton'
import { getDashboardData } from '@/lib/server/queries'
import { getSession } from '@/lib/server-auth'

export default async function DashboardPage() {
  const session = await getSession()
  const userId = session?.userId

  // Sem sessão → middleware já redireciona, mas por segurança:
  if (!userId) {
    redirect('/login')
  }

  // Pré-carregar dados no servidor se tiver userId
  let initialData = null
  try {
    initialData = await getDashboardData(userId)
  } catch (error) {
    const msg = error instanceof Error ? error.message : ''
    if (msg === 'Usuário não encontrado') {
      // Cookie aponta para userId inexistente no banco → redireciona para login
      redirect('/login')
    }
    console.error('Error loading dashboard data:', error)
  }

  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar title="Dashboard" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <Suspense fallback={<DashboardSkeleton />}>
          <DashboardContent initialData={initialData} />
        </Suspense>
      </main>
    </div>
  )
}
