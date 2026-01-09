'use client'

import { useEffect, useCallback, ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'default' | 'large'
}

export function Modal({ isOpen, onClose, title, children, size = 'default' }: ModalProps) {
  const handleEscape = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose()
    }
  }, [onClose])

  const handleBackdropClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }, [onClose])

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen, handleEscape])

  if (!isOpen) return null

  const modalClass = size === 'large' ? 'modal modal--large' : 'modal'

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className={modalClass} role="dialog" aria-modal="true" aria-labelledby={title ? 'modal-title' : undefined}>
        <div className="modal__header">
          {title && <h2 id="modal-title" className="modal__title">{title}</h2>}
          <button
            className="modal__close"
            onClick={onClose}
            aria-label="Close modal"
          >
            ×
          </button>
        </div>
        <div className="modal__content scrollable-content">
          {children}
        </div>
      </div>
    </div>
  )
}
