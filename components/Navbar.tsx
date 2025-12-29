'use client'

import Link from 'next/link'
import { Activity, Users, LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'

interface NavbarProps {
  title?: string
  showBack?: boolean
}

export default function Navbar({ title, showBack = false }: NavbarProps) {
  const { user, dailyUser, signOut } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <nav className="bg-white border-b border-slate-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          {showBack ? (
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Activity className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">
                Daily<span className="text-indigo-600">Sync</span>
              </span>
            </Link>
          ) : (
            <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Activity className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">
                Daily<span className="text-indigo-600">Sync</span>
              </span>
            </Link>
          )}
          <div className="flex items-center gap-4">
            {title && (
              <div className="text-sm text-slate-500 hidden sm:block">
                {title}
              </div>
            )}
            {!showBack && (
              <Link
                href="/users"
                className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors text-sm font-medium"
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Usuários</span>
              </Link>
            )}
            
            {/* User Info and Logout */}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-200">
                <div className="flex items-center gap-2 text-sm">
                  <div className="bg-indigo-100 p-1.5 rounded-full">
                    <UserIcon className="w-4 h-4 text-indigo-600" />
                  </div>
                  <span className="hidden md:inline text-slate-700 font-medium">
                    {dailyUser?.name || user.email?.split('@')[0] || 'Usuário'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-2 px-3 py-2 text-slate-700 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors text-sm font-medium"
                  title="Sair"
                >
                  <LogOut className="w-4 h-4" />
                  <span className="hidden sm:inline">Sair</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  )
}
