'use client'

import Navbar from '@/components/Navbar'
import LeadManagement from '@/components/LeadManagement'

export default function UsersPage() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Navbar title="Gestão de Usuários" showBack />
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-8 pt-24">
        <div className="fade-in">
          <LeadManagement />
        </div>
      </main>
    </div>
  )
}
