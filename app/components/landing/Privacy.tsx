'use client'

import { Shield } from 'lucide-react'

export function Privacy() {
  return (
    <section className="privacy-section" id="privacy">
      <div className="privacy-section__icon">
        <Shield size={48} />
      </div>

      <h2 className="privacy-section__title">Privacy Matters</h2>

      <p className="privacy-section__description">
        EchoVault is local-first by design. We don't collect your entries, track your usage,
        or analyze your life behind your back. You own your journal. You own your AI setup.
        We just give you the tools to make it powerful.
      </p>

      <p className="privacy-section__emphasis">
        Everything stays where you want it—on your machine, your server, or your terms.
      </p>
    </section>
  )
}
