import Navbar from '@/components/Navbar'
import UserForm from '@/components/UserForm'

export default function CreatePage() {
  return (
    <>
      <Navbar title="Criar Novo Usuário" showBack />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="fade-in">
          <UserForm />
        </div>
      </main>
    </>
  )
}
