import { ReactNode } from 'react'
import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CardProps {
  title?: string
  icon?: LucideIcon
  children: ReactNode
  headerActions?: ReactNode
  className?: string
  noPadding?: boolean
  variant?: 'default' | 'glass' | 'bordered'
}

export default function Card({
  title,
  icon: Icon,
  children,
  headerActions,
  className,
  noPadding = false,
  variant = 'default'
}: CardProps) {
  const variantStyles = {
    default: 'bg-slate-900/50 backdrop-blur-sm border border-slate-800/50',
    glass: 'glass-card',
    bordered: 'bg-slate-900 border-2 border-slate-800'
  }

  return (
    <div className={cn(variantStyles[variant], 'rounded-2xl shadow-sm', className)}>
      {title && (
        <div className={cn(
          'px-6 py-4 border-b border-slate-800/50',
          headerActions ? 'flex items-center justify-between' : '',
          headerActions ? 'bg-slate-900/30' : ''
        )}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="w-5 h-5 text-emerald-500" />}
            <h2 className="text-xl font-bold text-slate-100">{title}</h2>
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
