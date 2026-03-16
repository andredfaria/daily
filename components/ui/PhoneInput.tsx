'use client'

import { useState, forwardRef, useImperativeHandle, useRef } from 'react'
import { ChevronDown, MessageCircle, Loader2, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'

const BRAZIL_DDDS = [
  '11', '12', '13', '14', '15', '16', '17', '18', '19', // SP
  '21', '22', '24',                               // RJ
  '27', '28',                                    // ES
  '31', '32', '33', '34', '35', '37', '38',           // MG
  '41', '42', '43', '44', '45', '46',                // PR
  '47', '48', '49',                               // SC
  '51', '53', '54', '55',                          // RS
  '61',                                         // DF
  '62', '64',                                    // GO
  '63',                                         // TO
  '65', '66',                                    // MT
  '67',                                         // MS
  '68',                                         // AC
  '69',                                         // RO
  '71', '73', '74', '75', '77',                     // BA
  '79',                                         // SE
  '81', '87',                                    // PE
  '82',                                         // AL
  '83',                                         // PB
  '84',                                         // RN
  '85', '88',                                    // CE
  '86', '89',                                    // PI
  '91', '93', '94',                               // PA
  '92', '97',                                    // AM
  '95',                                         // RR
  '96',                                         // AP
  '98', '99',                                    // MA
]

type WAHAStatus = 'idle' | 'checking' | 'valid' | 'invalid'

export interface PhoneInputRef {
  getFullPhone: () => string
}

interface PhoneInputProps {
  ddd: string
  number: string
  onDDDChange: (ddd: string) => void
  onNumberChange: (number: string) => void
  wahaStatus?: WAHAStatus
  disabled?: boolean
  autoFocus?: boolean
  id?: string
}

const PhoneInput = forwardRef<PhoneInputRef, PhoneInputProps>(
  ({ ddd, number, onDDDChange, onNumberChange, wahaStatus = 'idle', disabled, autoFocus, id }, ref) => {
    const [ddiOpen, setDdiOpen] = useState(false)
    const [dddOpen, setDddOpen] = useState(false)
    const numberInputRef = useRef<HTMLInputElement>(null)

    useImperativeHandle(ref, () => ({
      getFullPhone: () => `+55${ddd}${number.replace(/\D/g, '')}`,
    }))

    const formatNumber = (raw: string) => {
      const digits = raw.replace(/\D/g, '').slice(0, 9)
      if (digits.length <= 5) return digits
      return `${digits.slice(0, 5)}-${digits.slice(5)}`
    }

    const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const digits = e.target.value.replace(/\D/g, '').slice(0, 9)
      onNumberChange(digits)
    }

    const borderColor =
      wahaStatus === 'valid'
        ? 'border-emerald-500'
        : wahaStatus === 'invalid'
          ? 'border-red-500'
          : 'border-slate-700'

    const ringColor =
      wahaStatus === 'valid'
        ? 'ring-emerald-500/20'
        : wahaStatus === 'invalid'
          ? 'ring-red-500/20'
          : 'ring-emerald-500/20'

    return (
      <div className={cn(
        'flex items-stretch rounded-lg border bg-slate-950/50 transition-all focus-within:ring-2',
        borderColor,
        ringColor,
        disabled && 'opacity-50 cursor-not-allowed'
      )}>
        {/* DDI — fixo +55 */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setDdiOpen(!ddiOpen); setDddOpen(false) }}
            className="h-full flex items-center gap-1 px-3 text-sm text-slate-300 hover:text-white border-r border-slate-700 transition-colors whitespace-nowrap"
          >
            <span className="font-mono">+55</span>
            <ChevronDown className={cn('w-3 h-3 text-slate-500 transition-transform', ddiOpen && 'rotate-180')} />
          </button>
          {ddiOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl p-2 min-w-[160px]">
              <div className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-emerald-500/10 text-emerald-400 text-sm">
                <span>Brasil (+55)</span>
              </div>
              <p className="text-xs text-slate-500 px-2 pt-2">Outros países em breve</p>
            </div>
          )}
        </div>

        {/* DDD */}
        <div className="relative flex-shrink-0">
          <button
            type="button"
            disabled={disabled}
            onClick={() => { setDddOpen(!dddOpen); setDdiOpen(false) }}
            className="h-full flex items-center gap-1 px-3 text-sm font-mono text-slate-300 hover:text-white border-r border-slate-700 transition-colors"
          >
            <span>{ddd || 'DDD'}</span>
            <ChevronDown className={cn('w-3 h-3 text-slate-500 transition-transform', dddOpen && 'rotate-180')} />
          </button>
          {dddOpen && (
            <div className="absolute top-full left-0 mt-1 z-50 bg-slate-900 border border-slate-700 rounded-lg shadow-xl overflow-hidden">
              <div className="max-h-52 overflow-y-auto p-1 grid grid-cols-4 gap-0.5 w-44">
                {BRAZIL_DDDS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      onDDDChange(d)
                      setDddOpen(false)
                      numberInputRef.current?.focus()
                    }}
                    className={cn(
                      'px-2 py-1.5 rounded text-sm font-mono text-center transition-colors',
                      d === ddd
                        ? 'bg-emerald-500 text-white font-bold'
                        : 'text-slate-300 hover:bg-slate-800'
                    )}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Número */}
        <input
          ref={numberInputRef}
          id={id}
          type="tel"
          inputMode="numeric"
          value={formatNumber(number)}
          onChange={handleNumberChange}
          onClick={() => { setDdiOpen(false); setDddOpen(false) }}
          placeholder="99999-9999"
          disabled={disabled}
          autoFocus={autoFocus}
          className="flex-1 px-3 py-3 bg-transparent outline-none text-slate-100 placeholder:text-slate-500 font-mono text-sm min-w-0"
        />

        {/* Status WAHA */}
        <div className="flex items-center pr-3 flex-shrink-0">
          {wahaStatus === 'checking' && (
            <Loader2 className="w-4 h-4 text-slate-400 animate-spin" />
          )}
          {wahaStatus === 'valid' && (
            <div className="flex items-center gap-1">
              <MessageCircle className="w-4 h-4 text-emerald-500" />
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
            </div>
          )}
          {wahaStatus === 'invalid' && (
            <X className="w-4 h-4 text-red-500" />
          )}
        </div>
      </div>
    )
  }
)

PhoneInput.displayName = 'PhoneInput'

export default PhoneInput
