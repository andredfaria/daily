import React from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface ToastProps {
  type: ToastType
  message: string
  exiting?: boolean
  onClose: () => void
}

const icons: Record<ToastType, string> = {
  success: 'check_circle',
  error: 'error',
  info: 'info',
  warning: 'warning',
}

const colors: Record<ToastType, { bg: string; icon: string; border: string }> = {
  success: {
    bg: 'bg-surface-container-high',
    icon: 'text-tertiary',
    border: 'border-tertiary/30',
  },
  error: {
    bg: 'bg-surface-container-high',
    icon: 'text-error',
    border: 'border-error/30',
  },
  info: {
    bg: 'bg-surface-container-high',
    icon: 'text-primary',
    border: 'border-primary/30',
  },
  warning: {
    bg: 'bg-surface-container-high',
    icon: 'text-yellow-400',
    border: 'border-yellow-400/30',
  },
}

const Toast: React.FC<ToastProps> = ({ type, message, exiting, onClose }) => {
  const c = colors[type]

  return (
    <div
      className={`
        pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl border
        shadow-2xl min-w-[280px] max-w-sm
        ${c.bg} ${c.border}
        ${exiting ? 'animate-toast-out' : 'animate-toast-in'}
      `}
    >
      <span className={`material-symbols-outlined text-xl flex-shrink-0 ${c.icon}`}>
        {icons[type]}
      </span>
      <p className="text-on-surface text-sm font-medium flex-1">{message}</p>
      <button
        onClick={onClose}
        className="text-on-surface-variant hover:text-on-surface transition-colors flex-shrink-0"
      >
        <span className="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  )
}

export default Toast
