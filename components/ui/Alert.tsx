'use client'

import { ReactNode } from 'react'
import { CheckCircle2, XCircle, AlertCircle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AlertProps {
    variant?: 'success' | 'error' | 'warning' | 'info'
    title?: string
    children: ReactNode
    onClose?: () => void
    className?: string
    action?: ReactNode
}

export default function Alert({
    variant = 'info',
    title,
    children,
    onClose,
    className,
    action
}: AlertProps) {
    const icons = {
        success: CheckCircle2,
        error: XCircle,
        warning: AlertCircle,
        info: Info,
    }

    const variantStyles = {
        success: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
        error: 'bg-red-500/10 border-red-500/20 text-red-400',
        warning: 'bg-yellow-500/10 border-yellow-500/20 text-yellow-400',
        info: 'bg-blue-500/10 border-blue-500/20 text-blue-400',
    }

    const Icon = icons[variant]

    return (
        <div className={cn(
            'rounded-lg border p-4 flex items-start gap-3',
            variantStyles[variant],
            className
        )}>
            <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
                {title && (
                    <h4 className="font-semibold mb-1">{title}</h4>
                )}
                <div className="text-sm opacity-90">
                    {children}
                </div>
                {action && (
                    <div className="mt-3">
                        {action}
                    </div>
                )}
            </div>
            {onClose && (
                <button
                    onClick={onClose}
                    className="flex-shrink-0 hover:opacity-70 transition-opacity"
                    aria-label="Fechar"
                >
                    <X className="w-4 h-4" />
                </button>
            )}
        </div>
    )
}
