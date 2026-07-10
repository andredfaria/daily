import React from 'react'

export const ProgressBar: React.FC<{ pct: number; size?: 'sm' | 'lg' }> = ({ pct, size = 'lg' }) => {
  const h = size === 'lg' ? 'h-3' : 'h-2'
  return (
    <div className={`w-full ${h} rounded-full bg-outline-variant/30 overflow-hidden`}>
      <div
        className={`${h} rounded-full transition-all duration-700 ${pct >= 100 ? 'bg-tertiary' : 'bg-primary'}`}
        style={{ width: `${Math.min(pct, 100)}%` }}
      />
    </div>
  )
}
