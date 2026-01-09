import { ReactNode } from 'react'
import { cn } from '@/lib/utils'

interface BadgeProps {
    children: ReactNode
    variant?: 'default' | 'success' | 'warning' | 'danger' | 'info'
    size?: 'sm' | 'md' | 'lg'
    className?: string
}

export default function Badge({
    children,
    variant = 'default',
    size = 'md',
    className
}: BadgeProps) {
    const baseStyles = 'inline-flex items-center justify-center font-medium rounded-full border'

    const variantStyles = {
        default: 'bg-slate-800 text-slate-300 border-slate-700',
        success: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
        warning: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
        danger: 'bg-red-500/10 text-red-400 border-red-500/20',
        info: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    }

    const sizeStyles = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-1 text-sm',
        lg: 'px-3 py-1.5 text-base'
    }

    return (
        <span className={cn(baseStyles, variantStyles[variant], sizeStyles[size], className)}>
            {children}
        </span>
    )
}
