import { ReactNode } from 'react'

interface CardProps {
  title?: string
  children: ReactNode
  headerActions?: ReactNode
  className?: string
  noPadding?: boolean
}

export default function Card({ title, children, headerActions, className = '', noPadding = false }: CardProps) {
  return (
    <div className={`bg-white rounded-2xl shadow-sm border border-slate-100 ${className}`}>
      {title && (
        <div className={`px-6 py-4 border-b border-slate-200 ${headerActions ? 'flex items-center justify-between' : ''} ${headerActions ? 'bg-slate-50' : ''}`}>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
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
