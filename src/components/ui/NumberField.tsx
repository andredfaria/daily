import React, { useId, useMemo, useRef } from 'react'
import {
  DEFAULT_DECIMALS,
  normalizeNumericInput,
  parseNumericInput,
  sanitizeNumericInput,
  stepNumericInput,
  type NumericMode,
} from '../../utils/numberInput'
import { formatBRL } from '../../utils/format'

export interface NumberFieldProps {
  /** Texto do campo. Sempre string — "" significa campo vazio, não zero. */
  value: string
  onChange: (value: string) => void
  label?: string
  /** integer = dia/quantidade inteira · decimal = quantidade · currency = R$ */
  mode?: NumericMode
  decimals?: number
  min?: number
  max?: number
  /** Passo das setas ↑/↓ do teclado. */
  step?: number
  prefix?: string
  suffix?: string
  placeholder?: string
  hint?: string
  error?: string
  required?: boolean
  disabled?: boolean
  clearable?: boolean
  autoFocus?: boolean
  name?: string
  className?: string
  /** Sobrescreve o visual do input (ex.: card mais escuro do onboarding). */
  inputClassName?: string
  onBlur?: () => void
}

/**
 * Campo numérico do BillSync.
 *
 * Por que não `type="number"`:
 * - a roda do mouse altera o valor sem querer e as setinhas ocupam área de toque;
 * - no Brasil o usuário digita vírgula, que o navegador descarta silenciosamente;
 * - o valor fica inacessível quando inválido, o que atrapalha a validação.
 *
 * Aqui usamos `type="text"` + `inputMode`, que abre o teclado numérico no
 * celular do mesmo jeito, e mantemos o estado como string para o campo poder
 * ficar vazio de verdade. Normalização (vírgula solta, min/max, centavos)
 * acontece no blur — nunca a cada tecla, para não brigar com quem está digitando.
 */
const NumberField: React.FC<NumberFieldProps> = ({
  value,
  onChange,
  label,
  mode = 'currency',
  decimals,
  min,
  max,
  step,
  prefix,
  suffix,
  placeholder,
  hint,
  error,
  required = false,
  disabled = false,
  clearable = true,
  autoFocus = false,
  name,
  className = '',
  inputClassName = '',
  onBlur,
}) => {
  const reactId = useId()
  const inputId = name ?? `num-${reactId}`
  const hintId = `${inputId}-hint`
  const errorId = `${inputId}-error`
  const inputRef = useRef<HTMLInputElement>(null)

  const casas = decimals ?? DEFAULT_DECIMALS[mode]
  const passo = step ?? 1
  const padDecimals = mode === 'currency'
  const opcoes = { decimals: casas, min, max, padDecimals }

  const temValor = value !== ''
  const mostraLimpar = clearable && !disabled

  // Eco do valor entendido: em dinheiro alto, "2000" vs "2.000,00" é
  // exatamente onde o usuário se perde. Só aparece quando ajuda.
  const eco = useMemo(() => {
    if (mode !== 'currency' || error) return null
    const numero = parseNumericInput(value)
    return numero !== null && Math.abs(numero) >= 1000 ? formatBRL(numero) : null
  }, [mode, value, error])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onChange(sanitizeNumericInput(e.target.value, { decimals: casas }))
  }

  const handleBlur = () => {
    const normalizado = normalizeNumericInput(value, opcoes)
    if (normalizado !== value) onChange(normalizado)
    onBlur?.()
  }

  // Setas ↑/↓ repõem o incremento que o spinner nativo daria.
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
    e.preventDefault()
    onChange(stepNumericInput(value, e.key === 'ArrowUp' ? passo : -passo, opcoes))
  }

  const limpar = () => {
    onChange('')
    inputRef.current?.focus()
  }

  // Erro e ajuda ocupam o mesmo espaço abaixo do campo — descreve o que existe.
  const descricao = error ? errorId : hint || eco ? hintId : undefined

  return (
    <div className={className}>
      {label && (
        <label htmlFor={inputId} className="label">
          {label}
          {required && <span className="text-error"> *</span>}
        </label>
      )}

      <div className="relative">
        {prefix && (
          <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-on-surface-variant">
            {prefix}
          </span>
        )}

        <input
          ref={inputRef}
          id={inputId}
          name={name}
          type="text"
          inputMode={casas > 0 ? 'decimal' : 'numeric'}
          enterKeyHint="done"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          autoFocus={autoFocus}
          disabled={disabled}
          // Obrigatoriedade é anunciada, mas não delegada ao navegador: o balão
          // nativo apareceria por cima da nossa mensagem de erro no campo.
          aria-required={required}
          value={value}
          placeholder={placeholder}
          onChange={handleChange}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          aria-invalid={!!error}
          aria-describedby={descricao}
          className={[
            'input-field tabular-nums min-h-[48px] disabled:opacity-50 disabled:cursor-not-allowed',
            error ? 'error' : '',
            prefix ? 'pl-10' : '',
            // Espaço reservado o tempo todo: o botão limpar aparecendo não
            // pode empurrar o que já está escrito.
            suffix && mostraLimpar ? 'pr-[5.25rem]' : suffix || mostraLimpar ? 'pr-12' : '',
            inputClassName,
          ]
            .filter(Boolean)
            .join(' ')}
        />

        {suffix && (
          <span
            className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-sm font-medium text-on-surface-variant ${
              mostraLimpar ? 'right-12' : 'right-4'
            }`}
          >
            {suffix}
          </span>
        )}

        {mostraLimpar && (
          <button
            type="button"
            tabIndex={temValor ? 0 : -1}
            aria-hidden={!temValor}
            aria-label={label ? `Limpar ${label}` : 'Limpar campo'}
            onClick={limpar}
            className={`absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-xl text-on-surface-variant transition-all duration-200 hover:bg-surface-container-high hover:text-on-surface ${
              temValor ? 'cursor-pointer opacity-100' : 'pointer-events-none opacity-0'
            }`}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        )}
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-1 flex items-center gap-1 text-xs text-error">
          <span className="material-symbols-outlined text-sm">error</span>
          {error}
        </p>
      ) : (
        (hint || eco) && (
          <p id={hintId} className="mt-1 text-xs text-on-surface-variant">
            {hint}
            {hint && eco && ' · '}
            {eco}
          </p>
        )
      )}
    </div>
  )
}

export default NumberField
