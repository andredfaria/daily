import React from 'react'

interface StatCardProps {
  icon: string
  label: string
  value: string | number
  iconColor: string
  iconBg: string
}

export const StatCard: React.FC<StatCardProps> = ({ icon, label, value, iconColor, iconBg }) => (
  <div className="glass-card rounded-2xl border border-outline-variant/50 p-5 animate-fadeIn">
    <div className="flex items-center justify-between mb-3">
      <div className={`w-9 h-9 rounded-xl ${iconBg} flex items-center justify-center`}>
        <span className={`material-symbols-outlined text-lg ${iconColor}`}>{icon}</span>
      </div>
    </div>
    <div className="text-2xl font-bold text-on-surface mb-0.5">{value}</div>
    <div className="text-xs text-on-surface-variant font-medium">{label}</div>
  </div>
)
