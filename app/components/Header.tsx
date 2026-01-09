'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { ThemeToggle } from './ThemeToggle'
import { PenLine, BookOpen, Settings, HelpCircle, Home } from 'lucide-react'

interface HeaderProps {
  title?: string
  showNav?: boolean
}

export function Header({ title, showNav = true }: HeaderProps) {
  const { user } = useAuth()
  const pathname = usePathname()

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
        {title ? (
          <h1 className="header__title">{title}</h1>
        ) : (
          <h1 className="header__title">
            Welcome back, {user?.username ?? 'User'}
          </h1>
        )}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <Link href="/" className="btn btn-ghost btn-sm">
            <Home size={16} />
            Home
          </Link>
        </div>
      </div>

      {showNav && (
        <nav className="header__nav">
          {navLinks.map((link) => {
            const Icon = link.icon
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`nav-link ${isActive(link.href) ? 'nav-link--active' : ''}`}
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
