import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'

interface CardProps {
  title?: string
  icon?: LucideIcon
  children: ReactNode
  headerActions?: ReactNode
  className?: string
  noPadding?: boolean
}

export default function Card({ title, icon: Icon, children, headerActions, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>
      {title && (
        <div className={`px-6 py-4 border-b border-slate-200 ${headerActions ? 'flex items-center justify-between' : ''} ${headerActions ? 'bg-slate-50' : ''}`}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-slate-600" />}
            <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          </div>
          {headerActions && (
            <div className="flex items-center gap-2">
              {headerActions}
            </div>
          )}
        </div>
      )}
      <div className={noPadding ? '' : 'p-6'}>
        {children}
      </div>
    </div>
  )
}
