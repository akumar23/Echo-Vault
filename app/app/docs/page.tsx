import { ArrowLeft, BookOpen, ExternalLink, Github } from 'lucide-react'
import Link from 'next/link'

const DEEPWIKI_URL = 'https://deepwiki.com/akumar23/Echo-Vault'

export const metadata = {
  title: 'Documentation | EchoVault',
  description: 'Technical documentation for EchoVault - architecture and setup.',
}

export default function DocsPage() {
  return (
    <div className="docs-page docs-page--link">
      <div className="docs-page__header">
        <Link href="/" className="docs-page__back">
          <ArrowLeft size={16} />
          Back to Home
        </Link>
        <h1>EchoVault Documentation</h1>
        <p>Architecture, setup, and technical reference</p>
      </div>

      <div className="docs-cta">
        <div className="docs-cta__icon">
          <BookOpen size={28} />
        </div>
        <h2>Read the docs on DeepWiki</h2>
        <p>
          EchoVault&apos;s documentation is hosted on DeepWiki — an auto-generated,
          always-current technical wiki covering architecture, data flows, and setup.
        </p>
        <a
          href={DEEPWIKI_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          Open Documentation
          <ExternalLink size={16} />
        </a>
        <a
          href="https://github.com/akumar23/Echo-Vault"
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-ghost"
        >
          <Github size={18} />
          View on GitHub
        </a>
      </div>
    </div>
  )
}
