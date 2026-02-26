'use client'

import { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import Card from './ui/Card'

interface KPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconBgColor?: string
  iconColor?: string
  subtitle?: string
  progressBar?: {
    percentage: number
    color: 'red' | 'yellow' | 'green' | 'blue' | 'emerald'
  }
  className?: string
}

export default function KPICard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  subtitle,
  progressBar,
  className
}: KPICardProps) {
  const progressColors = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-emerald-500',
    emerald: 'bg-emerald-500',
    blue: 'bg-blue-500'
  }

  // Default colors if not provided
  const bgColor = iconBgColor || 'bg-emerald-500/10'
  const textColor = iconColor || 'text-emerald-500'

  return (
    <Card className={cn('hover:border-emerald-500/50 transition-all', className)} noPadding>
      <div className="p-6">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <h3 className="text-3xl font-bold text-slate-100 mt-2">{value}</h3>
          </div>
          <div className={cn('p-2 rounded-lg', bgColor, textColor)}>
            <Icon className="w-6 h-6" />
          </div>
        </div>
        {progressBar && (
          <div className="mt-4 w-full bg-slate-800 rounded-full h-2">
            <div
              className={cn(progressColors[progressBar.color], 'h-2 rounded-full transition-all')}
              style={{ width: `${progressBar.percentage}%` }}
            />
          </div>
        )}
        {subtitle && (
          <p className="text-sm text-slate-500 mt-4">{subtitle}</p>
        )}
      </div>
    </Card>
  )
}
