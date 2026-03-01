'use client'

import { useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ThemeToggle } from './ThemeToggle'
import { PersonalizedGreeting } from './PersonalizedGreeting'
import { PenLine, BookOpen, Settings, HelpCircle, Home, Menu, X } from 'lucide-react'

interface HeaderProps {
  title?: string
  showNav?: boolean
  showGreeting?: boolean
}

export function Header({ title, showNav = true, showGreeting = false }: HeaderProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  const toggleMobileMenu = useCallback(() => {
    setMobileMenuOpen(prev => !prev)
  }, [])

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  const navLinks = [
    { href: '/new', label: 'New Entry', icon: PenLine },
    { href: '/entries', label: 'All Entries', icon: BookOpen },
    { href: '/settings', label: 'Settings', icon: Settings },
    { href: '/help', label: 'Help', icon: HelpCircle },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="header">
      <div className="header__top">
        {showGreeting ? (
          <PersonalizedGreeting />
        ) : title ? (
          <h1 className="header__title">{title}</h1>
        ) : null}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="btn btn-ghost btn-sm">
            <Home size={16} />
            <span className="hidden-mobile">Home</span>
          </Link>
          {showNav && (
            <button
              className="header__menu-toggle"
              onClick={toggleMobileMenu}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-nav"
              aria-label={mobileMenuOpen ? 'Close menu' : 'Open menu'}
            >
              {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          )}
        </div>
      </div>

      {showNav && (
        <nav
          id="mobile-nav"
          className={`header__nav ${mobileMenuOpen ? 'header__nav--open' : ''}`}
        >
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${isActive(link.href) ? 'nav-link--active' : ''}`}
                onClick={closeMobileMenu}
              >
                <Icon size={18} />
                {link.label}
              </Link>
            )
          })}
        </nav>
      )}
    </header>
  )
}
