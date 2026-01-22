'use client'

import Link from 'next/link'
import { Github, FileText, Mail, PenLine, Brain } from 'lucide-react'

export function Footer() {
  return (
    <footer className="landing-footer">
      <div className="landing-footer__content">
        <div className="landing-footer__brand">
          <h3 className="landing-footer__logo">EchoVault</h3>
          <p className="landing-footer__tagline">
            Private, AI-powered journaling
          </p>
        </div>

        <div className="landing-footer__links">
          <div className="landing-footer__column">
            <h4>Product</h4>
            <ul>
              <li><Link href="/register">Get Started</Link></li>
              <li><Link href="#features">Features</Link></li>
              <li><Link href="#how-it-works">How It Works</Link></li>
              <li><Link href="/login">Sign In</Link></li>
            </ul>
          </div>

          <div className="landing-footer__column">
            <h4>Resources</h4>
            <ul>
              <li>
                <a href="https://github.com/yourusername/echovault" target="_blank" rel="noopener noreferrer">
                  <Github size={14} />
                  GitHub
                </a>
              </li>
              <li>
                <Link href="/docs">
                  <FileText size={14} />
                  Docs
                </Link>
              </li>
              <li>
                <a href="mailto:contact@echovault.app">
                  <Mail size={14} />
                  Contact
                </a>
              </li>
            </ul>
          </div>

          <div className="landing-footer__column">
            <h4>Legal</h4>
            <ul>
              <li><Link href="/privacy">Privacy</Link></li>
              <li><Link href="/terms">Terms</Link></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="landing-footer__bottom">
        <p className="landing-footer__copyright">
          EchoVault &copy; {new Date().getFullYear()}
        </p>
        <p className="landing-footer__made-with">
          Made with <PenLine size={14} className="landing-footer__icon" /> + <Brain size={14} className="landing-footer__icon" />
        </p>
      </div>
    </footer>
  )
}
