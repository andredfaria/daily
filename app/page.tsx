import Navbar from '@/components/Navbar'
import DashboardContent from '@/components/DashboardContent'

interface PageProps {
  searchParams: Promise<{ id?: string }>
}

export default async function Home({ searchParams }: PageProps) {
  const params = await searchParams
  const userId = params.id

  return (
    <>
      <Navbar title="Dashboard de Performance" />
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <DashboardContent userId={userId} />
      </main>
    </>
  )
}
