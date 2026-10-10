import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export interface OpcaoSelect<V extends string = string> {
  value: V
  label: string
  /** Ícone material à esquerda do texto. */
  icon?: string
  /** Linha menor abaixo do texto, só na lista. */
  descricao?: string
}

interface SelectProps<V extends string> {
  value: V
  onChange: (value: V) => void
  options: OpcaoSelect<V>[]
  id?: string
  'aria-label'?: string
  /** 'field' segue o .input-field dos formulários; 'chip' é o filtro compacto das listas. */
  variant?: 'field' | 'chip'
  /** Chip em destaque — use quando o filtro está aplicado. */
  ativo?: boolean
  placeholder?: string
  disabled?: boolean
  className?: string
}

const ALTURA_MAXIMA = 288
const MARGEM = 8

/**
 * Select desenhado pelo app. A lista do <select> nativo é do sistema: abre
 * cinza e sem estilo no tema escuro. O painel vai por portal para o <body>,
 * porque dentro de um .glass-card o backdrop-filter prenderia o position: fixed.
 */
function Select<V extends string>({
  value,
  onChange,
  options,
  id,
  'aria-label': ariaLabel,
  variant = 'field',
  ativo = false,
  placeholder = 'Selecione',
  disabled = false,
  className = '',
}: SelectProps<V>) {
  const [aberto, setAberto] = useState(false)
  const [indiceAtivo, setIndiceAtivo] = useState(-1)
  const [posicao, setPosicao] = useState<{ top: number; left: number; width: number; paraCima: boolean } | null>(null)
  const gatilhoRef = useRef<HTMLButtonElement>(null)
  const listaRef = useRef<HTMLUListElement>(null)
  const busca = useRef({ texto: '', ate: 0 })
  const listaId = useId()
  const idDoGatilho = id ?? `${listaId}-gatilho`

  const selecionada = options.find((o) => o.value === value)
  const indiceSelecionado = options.findIndex((o) => o.value === value)

  const posicionar = useCallback(() => {
    const r = gatilhoRef.current?.getBoundingClientRect()
    if (!r) return
    const abaixo = window.innerHeight - r.bottom
    const paraCima = abaixo < Math.min(ALTURA_MAXIMA, options.length * 44 + 16) && r.top > abaixo
    const width = Math.max(r.width, 200)
    const left = Math.min(Math.max(MARGEM, r.left), window.innerWidth - width - MARGEM)
    setPosicao({ top: paraCima ? r.top - 6 : r.bottom + 6, left, width, paraCima })
  }, [options.length])

  const abrir = useCallback(() => {
    if (disabled) return
    posicionar()
    setIndiceAtivo(indiceSelecionado >= 0 ? indiceSelecionado : 0)
    setAberto(true)
  }, [disabled, posicionar, indiceSelecionado])

  const fechar = useCallback((devolverFoco = true) => {
    setAberto(false)
    if (devolverFoco) gatilhoRef.current?.focus()
  }, [])

  const escolher = (i: number) => {
    const opcao = options[i]
    if (!opcao) return
    if (opcao.value !== value) onChange(opcao.value)
    fechar()
  }

  // Fecha ao clicar fora e acompanha rolagem/redimensionamento.
  useEffect(() => {
    if (!aberto) return
    const fora = (e: PointerEvent) => {
      const alvo = e.target as Node
      if (!gatilhoRef.current?.contains(alvo) && !listaRef.current?.contains(alvo)) fechar(false)
    }
    document.addEventListener('pointerdown', fora)
    window.addEventListener('resize', posicionar)
    window.addEventListener('scroll', posicionar, true)
    return () => {
      document.removeEventListener('pointerdown', fora)
      window.removeEventListener('resize', posicionar)
      window.removeEventListener('scroll', posicionar, true)
    }
  }, [aberto, fechar, posicionar])

  // Foco na lista ao abrir; opção ativa sempre visível.
  useLayoutEffect(() => {
    if (aberto) listaRef.current?.focus({ preventScroll: true })
  }, [aberto])
  useEffect(() => {
    if (!aberto || indiceAtivo < 0) return
    listaRef.current?.querySelector<HTMLElement>(`[data-indice="${indiceAtivo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [aberto, indiceAtivo])

  // Digitar a inicial pula para a opção (como no select nativo).
  const buscarPorTexto = (tecla: string): number => {
    const agora = Date.now()
    busca.current = { texto: (agora < busca.current.ate ? busca.current.texto : '') + tecla.toLowerCase(), ate: agora + 600 }
    const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    return options.findIndex((o) => norm(o.label).startsWith(norm(busca.current.texto)))
  }

  const teclaNoGatilho = (e: React.KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault()
      abrir()
    }
  }

  const teclaNaLista = (e: React.KeyboardEvent) => {
    const ultimo = options.length - 1
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); setIndiceAtivo((i) => Math.min(ultimo, i + 1)); break
      case 'ArrowUp': e.preventDefault(); setIndiceAtivo((i) => Math.max(0, i - 1)); break
      case 'Home': e.preventDefault(); setIndiceAtivo(0); break
      case 'End': e.preventDefault(); setIndiceAtivo(ultimo); break
      case 'Enter':
      case ' ': e.preventDefault(); escolher(indiceAtivo); break
      case 'Escape': e.preventDefault(); e.stopPropagation(); fechar(); break
      case 'Tab': fechar(false); break
      default:
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          const i = buscarPorTexto(e.key)
          if (i >= 0) setIndiceAtivo(i)
        }
    }
  }

  const estiloGatilho = variant === 'chip'
    ? `min-h-[44px] px-3 rounded-xl text-xs font-semibold border transition-colors ${
        ativo
          ? 'bg-primary/15 text-primary border-primary/30'
          : 'bg-surface-container text-on-surface-variant border-transparent hover:text-on-surface'
      }`
    : 'input-field text-left'

  return (
    <>
      <button
        ref={gatilhoRef}
        id={idDoGatilho}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={aberto}
        aria-controls={aberto ? listaId : undefined}
        aria-label={ariaLabel}
        disabled={disabled}
        onClick={() => (aberto ? fechar() : abrir())}
        onKeyDown={teclaNoGatilho}
        className={`${estiloGatilho} inline-flex items-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 ${variant === 'field' ? 'w-full' : ''} ${className}`}
      >
        {selecionada?.icon && (
          <span aria-hidden="true" className={`material-symbols-outlined ${variant === 'chip' ? 'text-base' : 'text-lg text-on-surface-variant'}`}>
            {selecionada.icon}
          </span>
        )}
        <span className={`flex-1 truncate ${selecionada ? '' : 'text-outline'}`}>
          {selecionada?.label ?? placeholder}
        </span>
        <span
          aria-hidden="true"
          className={`material-symbols-outlined ${variant === 'chip' ? 'text-base' : 'text-xl text-on-surface-variant'} transition-transform duration-200 ${aberto ? 'rotate-180' : ''}`}
        >
          expand_more
        </span>
      </button>

      {aberto && posicao && createPortal(
        <ul
          ref={listaRef}
          id={listaId}
          role="listbox"
          tabIndex={-1}
          aria-labelledby={ariaLabel ? undefined : idDoGatilho}
          aria-label={ariaLabel}
          aria-activedescendant={indiceAtivo >= 0 ? `${listaId}-${indiceAtivo}` : undefined}
          onKeyDown={teclaNaLista}
          style={{
            position: 'fixed',
            left: posicao.left,
            width: posicao.width,
            maxHeight: ALTURA_MAXIMA,
            ...(posicao.paraCima ? { bottom: window.innerHeight - posicao.top } : { top: posicao.top }),
          }}
          className={`z-[60] overflow-y-auto overscroll-contain p-1.5 rounded-xl border border-outline-variant/60 bg-surface-container-high shadow-2xl shadow-black/40 outline-none motion-safe:animate-[selectIn_150ms_ease-out] ${posicao.paraCima ? 'origin-bottom' : 'origin-top'}`}
        >
          {options.map((o, i) => {
            const marcada = o.value === value
            return (
              <li
                key={o.value}
                id={`${listaId}-${i}`}
                data-indice={i}
                role="option"
                aria-selected={marcada}
                onPointerEnter={() => setIndiceAtivo(i)}
                onClick={() => escolher(i)}
                className={`flex items-center gap-3 min-h-[44px] px-3 py-2 rounded-lg text-sm cursor-pointer select-none transition-colors ${
                  i === indiceAtivo ? 'bg-primary/10' : ''
                } ${marcada ? 'text-primary font-semibold' : 'text-on-surface'}`}
              >
                {o.icon && (
                  <span aria-hidden="true" className={`material-symbols-outlined text-lg ${marcada ? 'text-primary' : 'text-on-surface-variant'}`}>
                    {o.icon}
                  </span>
                )}
                <span className="flex-1 min-w-0">
                  <span className="block truncate">{o.label}</span>
                  {o.descricao && <span className="block text-xs font-normal text-on-surface-variant truncate">{o.descricao}</span>}
                </span>
                <span aria-hidden="true" className={`material-symbols-outlined text-lg text-primary ${marcada ? '' : 'invisible'}`}>
                  check
                </span>
              </li>
            )
          })}
        </ul>,
        document.body,
      )}
    </>
  )
}

export default Select
