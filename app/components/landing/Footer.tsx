'use client'

import Link from 'next/link'
import { Github, FileText, Mail, PenLine, Brain } from 'lucide-react'
import { motion } from 'framer-motion'
import { FadeIn, useMotion } from '@/components/motion'

const productLinks = [
  { href: '/register', label: 'Get Started' },
  { href: '#features', label: 'Features' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '/login', label: 'Sign In' },
]

const resourceLinks = [
  { href: 'https://github.com/yourusername/echovault', label: 'GitHub', icon: Github, external: true },
  { href: '/docs', label: 'Docs', icon: FileText, external: false },
  { href: 'mailto:contact@echovault.app', label: 'Contact', icon: Mail, external: true },
]

const legalLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
]

export function Footer() {
  const { reducedMotion } = useMotion()

  return (
    <footer className="landing-footer-new">
      <div className="landing-footer-new__gradient" />

      <FadeIn>
        <div className="landing-footer-new__content">
          <div className="landing-footer-new__brand">
            <motion.h3
              className="landing-footer-new__logo"
              whileHover={{ scale: 1.02 }}
              transition={{ type: 'spring', stiffness: 400, damping: 15 }}
            >
              EchoVault
            </motion.h3>
            <p className="landing-footer-new__tagline">
              Private, AI-powered journaling
            </p>
          </div>

          <div className="landing-footer-new__links">
            <div className="landing-footer-new__column">
              <h4>Product</h4>
              <ul>
                {productLinks.map((link) => (
                  <li key={link.href}>
                    <motion.span
                      whileHover={reducedMotion ? {} : { x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <Link href={link.href} className="landing-footer-new__link">
                        {link.label}
                      </Link>
                    </motion.span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="landing-footer-new__column">
              <h4>Resources</h4>
              <ul>
                {resourceLinks.map((link) => (
                  <li key={link.href}>
                    <motion.span
                      whileHover={reducedMotion ? {} : { x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      {link.external ? (
                        <a
                          href={link.href}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="landing-footer-new__link landing-footer-new__link--icon"
                        >
                          <link.icon size={14} />
                          {link.label}
                        </a>
                      ) : (
                        <Link href={link.href} className="landing-footer-new__link landing-footer-new__link--icon">
                          <link.icon size={14} />
                          {link.label}
                        </Link>
                      )}
                    </motion.span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="landing-footer-new__column">
              <h4>Legal</h4>
              <ul>
                {legalLinks.map((link) => (
                  <li key={link.href}>
                    <motion.span
                      whileHover={reducedMotion ? {} : { x: 4 }}
                      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                    >
                      <Link href={link.href} className="landing-footer-new__link">
                        {link.label}
                      </Link>
                    </motion.span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="landing-footer-new__bottom">
          <p className="landing-footer-new__copyright">
            EchoVault &copy; {new Date().getFullYear()}
          </p>
          <motion.p
            className="landing-footer-new__made-with"
            whileHover={{ scale: 1.05 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15 }}
          >
            Made with{' '}
            <motion.span
              animate={reducedMotion ? {} : { rotate: [0, 10, -10, 0] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut' }}
              style={{ display: 'inline-block' }}
            >
              <PenLine size={14} className="landing-footer-new__icon" />
            </motion.span>
            {' '}+{' '}
            <motion.span
              animate={reducedMotion ? {} : { scale: [1, 1.1, 1] }}
              transition={{ repeat: Infinity, duration: 2, ease: 'easeInOut', delay: 0.5 }}
              style={{ display: 'inline-block' }}
            >
              <Brain size={14} className="landing-footer-new__icon" />
            </motion.span>
          </motion.p>
        </div>
      </FadeIn>

      <style jsx global>{`
        .landing-footer-new {
          position: relative;
          padding: var(--space-10) 0 var(--space-6);
          margin-top: var(--space-10);
        }

        .landing-footer-new__gradient {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 1px;
          background: linear-gradient(
            90deg,
            transparent 0%,
            var(--accent-subtle) 20%,
            var(--accent) 50%,
            var(--accent-subtle) 80%,
            transparent 100%
          );
        }

        .landing-footer-new__content {
          display: flex;
          justify-content: space-between;
          gap: var(--space-8);
          margin-bottom: var(--space-8);
        }

        .landing-footer-new__brand {
          max-width: 280px;
        }

        .landing-footer-new__logo {
          font-size: var(--text-xl);
          font-weight: 700;
          margin-bottom: var(--space-2);
          background: var(--gradient-warm-flow);
          background-size: 200% 200%;
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          animation: gradient-shift 6s ease infinite;
          display: inline-block;
        }

        .landing-footer-new__tagline {
          color: var(--text-muted);
          font-size: var(--text-sm);
        }

        .landing-footer-new__links {
          display: flex;
          gap: var(--space-10);
        }

        .landing-footer-new__column h4 {
          font-size: var(--text-sm);
          font-weight: 600;
          margin-bottom: var(--space-4);
          color: var(--text-primary);
        }

        .landing-footer-new__column ul {
          list-style: none;
          padding: 0;
          margin: 0;
          display: flex;
          flex-direction: column;
          gap: var(--space-2);
        }

        .landing-footer-new__link {
          font-size: var(--text-sm);
          color: var(--text-muted);
          text-decoration: none;
          transition: color 0.2s ease;
          display: inline-block;
        }

        .landing-footer-new__link:hover {
          color: var(--accent);
        }

        .landing-footer-new__link--icon {
          display: inline-flex;
          align-items: center;
          gap: var(--space-2);
        }

        .landing-footer-new__bottom {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: var(--space-6);
          border-top: 1px solid var(--border);
        }

        .landing-footer-new__copyright {
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .landing-footer-new__made-with {
          display: flex;
          align-items: center;
          gap: var(--space-1);
          font-size: var(--text-sm);
          color: var(--text-muted);
        }

        .landing-footer-new__icon {
          vertical-align: middle;
          color: var(--accent);
        }

        @media (max-width: 768px) {
          .landing-footer-new__content {
            flex-direction: column;
            gap: var(--space-6);
          }

          .landing-footer-new__brand {
            text-align: center;
            max-width: none;
          }

          .landing-footer-new__links {
            justify-content: center;
            flex-wrap: wrap;
            gap: var(--space-6);
          }

          .landing-footer-new__column {
            text-align: center;
          }

          .landing-footer-new__bottom {
            flex-direction: column;
            gap: var(--space-3);
            text-align: center;
          }
        }
      `}</style>
    </footer>
  )
}
