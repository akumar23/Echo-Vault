'use client'

import { useEffect, useCallback, useRef, ReactNode } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  size?: 'default' | 'large'
}

const FOCUSABLE_SELECTORS = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

export function Modal({ isOpen, onClose, title, children, size = 'default' }: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)
  const previousActiveElement = useRef<HTMLElement | null>(null)

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

  // Focus trap: keep focus within modal
  const handleTabKey = useCallback((e: KeyboardEvent) => {
    if (e.key !== 'Tab' || !modalRef.current) return

    const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
    if (focusableElements.length === 0) return

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    if (e.shiftKey) {
      // Shift+Tab: if on first element, go to last
      if (document.activeElement === firstElement) {
        e.preventDefault()
        lastElement.focus()
      }
    } else {
      // Tab: if on last element, go to first
      if (document.activeElement === lastElement) {
        e.preventDefault()
        firstElement.focus()
      }
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      // Store currently focused element to restore later
      previousActiveElement.current = document.activeElement as HTMLElement

      document.addEventListener('keydown', handleEscape)
      document.addEventListener('keydown', handleTabKey)
      document.body.style.overflow = 'hidden'

      // Focus first focusable element in modal
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS)
          if (focusableElements.length > 0) {
            focusableElements[0].focus()
          }
        }
      })
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('keydown', handleTabKey)
      document.body.style.overflow = ''

      // Restore focus to previously focused element
      if (previousActiveElement.current) {
        previousActiveElement.current.focus()
      }
    }
  }, [isOpen, handleEscape, handleTabKey])

  if (!isOpen) return null

  const modalClass = size === 'large' ? 'modal modal--large' : 'modal'

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div
        ref={modalRef}
        className={modalClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
      >
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
