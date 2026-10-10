import React, { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  /** Ícone material do topo; o padrão segue a variante. */
  icon?: string
  /** Conteúdo extra entre a descrição e os botões (ex.: um campo). */
  children?: React.ReactNode
}

const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  variant = 'default',
  loading = false,
  icon,
  children,
}) => {
  const tituloId = useId()

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleKey)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = ''
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  // Vai direto para o <body>: dentro de um .glass-card o backdrop-filter vira
  // referência do position: fixed, e o modal ficava preso ao tamanho do card.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="relative glass-card rounded-2xl border border-outline-variant/50 p-6 w-full max-w-md shadow-2xl animate-fadeIn"
      >
        {/* Icon */}
        <div className={`
          w-12 h-12 rounded-full flex items-center justify-center mb-4
          ${variant === 'danger' ? 'bg-error-container' : 'bg-primary/20'}
        `}>
          <span aria-hidden="true" className={`material-symbols-outlined ${variant === 'danger' ? 'text-error' : 'text-primary'}`}>
            {icon ?? (variant === 'danger' ? 'delete' : 'help')}
          </span>
        </div>

        <h2 id={tituloId} className="text-lg font-semibold text-on-surface mb-2">{title}</h2>
        <p className="text-sm text-on-surface-variant mb-6">{description}</p>

        {children && <div className="-mt-2 mb-6">{children}</div>}

        <div className="flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn-ghost"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className={variant === 'danger' ? 'btn-danger' : 'btn-primary'}
          >
            {loading && (
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
            )}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}

export default Modal
