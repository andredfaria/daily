import { InputHTMLAttributes, forwardRef } from 'react'
import { CheckCircle2, Loader2, LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  validated?: boolean
  validating?: boolean
  leftIcon?: LucideIcon
  rightIcon?: LucideIcon
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, validated, validating, leftIcon: LeftIcon, rightIcon: RightIcon, className, ...props }, ref) => {
    const baseStyles = 'w-full px-4 py-3 bg-slate-950/50 border rounded-lg focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 outline-none transition-all text-slate-100 placeholder:text-slate-500'

    let stateStyles = 'border-slate-800'
    if (error) {
      stateStyles = 'border-red-500/50 bg-red-500/5 focus:ring-red-500/50 focus:border-red-500'
    } else if (validated) {
      stateStyles = 'border-emerald-500/50 bg-emerald-500/5'
    }

    const hasLeftIcon = !!LeftIcon
    const hasRightIcon = !!RightIcon || validating || validated
    const paddingStyles = cn(
      hasLeftIcon && 'pl-11',
      hasRightIcon && 'pr-11'
    )

    return (
      <div className="relative">
        {LeftIcon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            <LeftIcon className="w-5 h-5 text-slate-500" />
          </div>
        )}
        <input
          ref={ref}
          className={cn(baseStyles, stateStyles, paddingStyles, className)}
          {...props}
        />
        {(validating || validated || RightIcon) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validating && (
              <Loader2 className="w-5 h-5 text-emerald-500 animate-spin" />
            )}
            {validated && !validating && (
              <CheckCircle2 className="w-5 h-5 text-emerald-500" />
            )}
            {RightIcon && !validating && !validated && (
              <RightIcon className="w-5 h-5 text-slate-500" />
            )}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
