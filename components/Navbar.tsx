import Link from 'next/link'
import { Activity, Users } from 'lucide-react'

interface NavbarProps {
  title?: string
  showBack?: boolean
}

export default function Navbar({ title, showBack = false }: NavbarProps) {
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
          </div>
        </div>
      </div>
    </nav>
  )
}
