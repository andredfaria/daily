import Navbar from '@/components/Navbar'
import UserForm from '@/components/UserForm'

export default function CreatePage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar title="Criar Novo Usuário" showBack />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="fade-in">
          <UserForm />
        </div>
      </main>
    </div>
  )
}
