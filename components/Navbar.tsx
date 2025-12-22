import Link from 'next/link'
import { Activity } from 'lucide-react'

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
            <div className="flex items-center gap-2">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <Activity className="text-white w-5 h-5" />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">
                Daily<span className="text-indigo-600">Sync</span>
              </span>
            </div>
          )}
          {title && (
            <div className="text-sm text-slate-500 hidden sm:block">
              {title}
            </div>
          )}
        </div>
      </div>
    </nav>
  )
}
