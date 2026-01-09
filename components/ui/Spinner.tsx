import { cn } from '@/lib/utils'

interface SpinnerProps {
    variant?: 'inline' | 'overlay' | 'page'
    size?: 'sm' | 'md' | 'lg'
    message?: string
    className?: string
}

export default function Spinner({
    variant = 'inline',
    size = 'md',
    message = 'Carregando...',
    className
}: SpinnerProps) {
    const sizeStyles = {
        sm: 'h-4 w-4 border-2',
        md: 'h-8 w-8 border-2',
        lg: 'h-12 w-12 border-3'
    }

    const spinner = (
        <div className={cn(
            'animate-spin rounded-full border-emerald-500 border-t-transparent',
            sizeStyles[size]
        )} />
    )

    if (variant === 'inline') {
        return (
            <div className={cn('flex items-center justify-center gap-3', className)}>
                {spinner}
                {message && <span className="text-slate-400 text-sm">{message}</span>}
            </div>
        )
    }

    if (variant === 'page') {
        return (
            <div className={cn('text-center py-20', className)}>
                <div className="flex justify-center mb-4">
                    {spinner}
                </div>
                {message && <p className="text-slate-400">{message}</p>}
            </div>
        )
    }

    // overlay variant
    return (
        <div className={cn(
            'fixed inset-0 bg-black/20 backdrop-blur-sm z-50 flex items-center justify-center',
            className
        )}>
            <div className="bg-slate-900 rounded-2xl shadow-xl p-8 flex flex-col items-center border border-slate-800">
                {spinner}
                {message && <p className="text-slate-300 font-medium mt-4">{message}</p>}
            </div>
        </div>
    )
}
