import React from 'react'

interface RadialGaugeProps {
  pct: number
  size?: number
  strokeWidth?: number
  color: string
  trackColor?: string
  children?: React.ReactNode
}

export const RadialGauge: React.FC<RadialGaugeProps> = ({
  pct,
  size = 96,
  strokeWidth = 10,
  color,
  trackColor = '#35343a',
  children,
}) => {
  const clamped = Math.min(Math.max(pct, 0), 100)
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="relative flex-shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={trackColor} strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 700ms ease-out' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        {children}
      </div>
    </div>
  )
}
