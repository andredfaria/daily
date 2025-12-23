import Navbar from '@/components/Navbar'
import UserManagement from '@/components/UserManagement'

export default function UsersPage() {
  return (
    <>
      <Navbar title="Gestão de Usuários" showBack />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="fade-in">
          <UserManagement />
        </div>
      </main>
    </>
  )
}
