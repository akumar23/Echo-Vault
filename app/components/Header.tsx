'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  title?: string
  showNav?: boolean
}

export function Header({ title, showNav = true }: HeaderProps) {
  const { user } = useAuth()
  const pathname = usePathname()

  const navLinks = [
    { href: '/new', label: 'New Entry' },
    { href: '/entries', label: 'All Entries' },
    { href: '/insights', label: 'Insights' },
    { href: '/settings', label: 'Settings' },
    { href: '/help', label: 'Help' },
  ]

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header className="header">
      <div className="header__top">
        {title ? (
          <h1 className="header__title">{title}</h1>
        ) : (
          <h1 className="header__title">
            Welcome back, {user?.username ?? 'User'}
          </h1>
        )}
        <Link href="/" className="btn btn-ghost btn-sm">
          Home
        </Link>
      </div>

      {showNav && (
        <nav className="header__nav">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`nav-link ${isActive(link.href) ? 'nav-link--active' : ''}`}
            >
              {link.label}
            </Link>
          ))}
        </nav>
      )}
    </header>
  )
}
