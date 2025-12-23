import { ReactNode } from 'react'
import { AlertCircle } from 'lucide-react'

interface FormFieldProps {
  label: string
  required?: boolean
  optional?: boolean
  error?: string | null
  helperText?: string
  children: ReactNode
  className?: string
}

export default function FormField({
  label,
  required = false,
  optional = false,
  error,
  helperText,
  children,
  className = ''
}: FormFieldProps) {
  return (
    <div className={className}>
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}{' '}
        {required && <span className="text-red-500">*</span>}
        {optional && <span className="text-slate-400">(opcional)</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          {error}
        </p>
      )}
      {helperText && !error && (
        <p className="mt-1 text-xs text-slate-500">{helperText}</p>
      )}
    </div>
  )
}
