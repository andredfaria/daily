import Navbar from '@/components/Navbar'
import DashboardContent from '@/components/DashboardContent'

interface PageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const params = await searchParams
  const userId = params.id

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 transition-colors duration-300">
      <Navbar title="Dashboard" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent userId={userId} />
      </main>
    </div>
  )
}
