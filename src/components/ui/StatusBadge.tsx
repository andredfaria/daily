import React from 'react'
import type { OccurrenceStatus } from '../../types'

interface StatusBadgeProps {
  status: OccurrenceStatus
  animate?: boolean
}

const config: Record<OccurrenceStatus, { label: string; classes: string; dot: string }> = {
  pending: {
    label: 'PENDENTE',
    classes: 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30',
    dot: 'bg-yellow-400',
  },
  paid: {
    label: 'PAGO',
    classes: 'bg-tertiary/15 text-tertiary border border-tertiary/30',
    dot: 'bg-tertiary',
  },
  overdue: {
    label: 'ATRASADO',
    classes: 'bg-error/15 text-error border border-error/30',
    dot: 'bg-error',
  },
  cancelled: {
    label: 'CANCELADO',
    classes: 'bg-outline/15 text-outline border border-outline/30',
    dot: 'bg-outline',
  },
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, animate }) => {
  const { label, classes, dot } = config[status]

  return (
    <span
      className={`
        inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold tracking-wide
        ${classes}
        ${animate ? 'animate-badgeGreen' : ''}
      `}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
      {label}
    </span>
  )
}

export default StatusBadge
