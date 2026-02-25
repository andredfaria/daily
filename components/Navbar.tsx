'use client'

import Link from 'next/link'
import { Activity, Users, LogOut, User as UserIcon } from 'lucide-react'
import { useAuth } from './AuthProvider'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils'

interface NavbarProps {
  title?: string
  showBack?: boolean
}

export default function Navbar({ title, showBack = false }: NavbarProps) {
  const { user, dailyUser, signOut, isAdmin } = useAuth()
  const router = useRouter()

  const handleLogout = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <nav className="fixed w-full z-50 bg-slate-950/80 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16 items-center">
          <Link href="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
              <Activity className="text-white w-5 h-5" />
            </div>
            <span className="font-bold text-xl tracking-tight text-white">
              Daily<span className="text-emerald-500">Sync</span>
            </span>
          </Link>

          <div className="flex items-center gap-4">
            {title && (
              <div className="text-sm text-slate-500 hidden sm:block">
                {title}
              </div>
            )}
            {isAdmin() && !showBack && (
              <Link
                href="/users"
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                  'text-slate-300 hover:text-white hover:bg-slate-800'
                )}
              >
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Usuários</span>
              </Link>
            )}

            <Link
              href="/user"
              className={cn(
                'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                'text-slate-300 hover:text-white hover:bg-slate-800'
              )}
            >
              <UserIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Minha Conta</span>
            </Link>

            {/* User Info and Logout */}
            {user && (
              <div className="flex items-center gap-3 pl-3 border-l border-slate-800">
                <div className="flex items-center gap-2 text-sm">
                  <div className="bg-emerald-500/10 p-1.5 rounded-full">
                    <UserIcon className="w-4 h-4 text-emerald-500" />
                  </div>
                  <span className="hidden md:inline text-slate-300 font-medium">
                    {dailyUser?.name || user.email?.split('@')[0] || 'Usuário'}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors text-sm font-medium',
                    'text-slate-300 hover:text-red-400 hover:bg-red-500/10'
                  )}
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
