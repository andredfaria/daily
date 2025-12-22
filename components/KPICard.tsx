import { LucideIcon } from 'lucide-react'

interface KPICardProps {
  title: string
  value: string | number
  icon: LucideIcon
  iconBgColor: string
  iconColor: string
  subtitle?: string
  progressBar?: {
    percentage: number
    color: 'red' | 'yellow' | 'green' | 'blue'
  }
}

export default function KPICard({
  title,
  value,
  icon: Icon,
  iconBgColor,
  iconColor,
  subtitle,
  progressBar
}: KPICardProps) {
  const progressColors = {
    red: 'bg-red-500',
    yellow: 'bg-yellow-500',
    green: 'bg-green-500',
    blue: 'bg-blue-600'
  }

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
      <div className="flex justify-between items-start">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold text-slate-900 mt-2">{value}</h3>
        </div>
        <div className={`p-2 ${iconBgColor} rounded-lg ${iconColor}`}>
          <Icon className="w-6 h-6" />
        </div>
      </div>
      {progressBar && (
        <div className="mt-4 w-full bg-slate-100 rounded-full h-2">
          <div
            className={`${progressColors[progressBar.color]} h-2 rounded-full transition-all`}
            style={{ width: `${progressBar.percentage}%` }}
          />
        </div>
      )}
      {subtitle && (
        <p className="text-sm text-slate-400 mt-4">{subtitle}</p>
      )}
    </div>
  )
}
