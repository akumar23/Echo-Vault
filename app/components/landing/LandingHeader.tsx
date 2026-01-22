'use client'

import Link from 'next/link'
import { Menu, X } from 'lucide-react'
import { useState } from 'react'

export function LandingHeader() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false)

  return (
    <header className="landing-header">
      <div className="landing-header__container">
        <Link href="/" className="landing-header__logo">
          EchoVault
        </Link>

        <nav className="landing-header__nav">
          <Link href="/#features" className="landing-header__link">
            Features
          </Link>
          <Link href="/docs" className="landing-header__link">
            Docs
          </Link>
          <a
            href="https://github.com/yourusername/echovault"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-header__link"
          >
            GitHub
          </a>
        </nav>

        <div className="landing-header__actions">
          <Link href="/login" className="btn btn-ghost">
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary">
            Get Started
          </Link>
        </div>

        <button
          className="landing-header__mobile-toggle"
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle mobile menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {isMobileMenuOpen && (
        <div className="landing-header__mobile-menu">
          <Link href="/#features" className="landing-header__mobile-link">
            Features
          </Link>
          <Link href="/docs" className="landing-header__mobile-link">
            Docs
          </Link>
          <a
            href="https://github.com/yourusername/echovault"
            target="_blank"
            rel="noopener noreferrer"
            className="landing-header__mobile-link"
          >
            GitHub
          </a>
          <hr className="landing-header__mobile-divider" />
          <Link href="/login" className="btn btn-ghost w-full">
            Sign In
          </Link>
          <Link href="/register" className="btn btn-primary w-full">
            Get Started
          </Link>
        </div>
      )}
    </header>
  )
}
