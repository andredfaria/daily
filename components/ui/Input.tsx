import { InputHTMLAttributes, forwardRef } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
  validated?: boolean
  validating?: boolean
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ error, validated, validating, className = '', ...props }, ref) => {
    const baseStyles = 'w-full px-4 py-3 border rounded-lg focus:ring-2 focus:border-indigo-500 outline-none transition-all'
    
    let stateStyles = 'border-slate-200'
    if (error) {
      stateStyles = 'border-red-300 bg-red-50 focus:ring-red-500 focus:border-red-500'
    } else if (validated) {
      stateStyles = 'border-green-300 bg-green-50'
    }
    
    const combinedClassName = `${baseStyles} ${stateStyles} ${className}`
    
    return (
      <div className="relative">
        <input
          ref={ref}
          className={combinedClassName}
          {...props}
        />
        {(validating || validated) && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {validating && (
              <Loader2 className="w-5 h-5 text-indigo-600 animate-spin" />
            )}
            {validated && !validating && (
              <CheckCircle2 className="w-5 h-5 text-green-600" />
            )}
          </div>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'

export default Input
