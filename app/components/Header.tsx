'use client'

import Link from 'next/link'
import { useAuth } from '@/contexts/AuthContext'

interface HeaderProps {
  title?: string
  showNav?: boolean
}

export function Header({ title, showNav = true }: HeaderProps) {
  const { user } = useAuth()

  return (
    <header style={{ marginBottom: '2rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        {title ? (
          <h1>{title}</h1>
        ) : (
          <h1>Welcome back, {user?.username ?? 'User'}</h1>
        )}
        <Link
          href="/"
          className="btn btn-secondary"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem'
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⌂</span>
          Home
        </Link>
      </div>

      {showNav && (
        <nav style={{ marginTop: '1rem' }}>
          <Link href="/new" style={{ marginRight: '1rem' }}>New Entry</Link>
          <Link href="/entries" style={{ marginRight: '1rem' }}>All Entries</Link>
          <Link href="/insights" style={{ marginRight: '1rem' }}>Insights</Link>
          <Link href="/settings" style={{ marginRight: '1rem' }}>Settings</Link>
          <Link href="/help">Help</Link>
        </nav>
      )}
    </header>
  )
}
