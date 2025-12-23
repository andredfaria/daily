import Navbar from '@/components/Navbar'
import LeadManagement from '@/components/LeadManagement'

export default function UsersPage() {
  return (
    <>
      <Navbar title="Gestão de Usuários" showBack />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="fade-in">
          <LeadManagement />
        </div>
      </main>
    </>
  )
}
