'use client'

export function Quote() {
  return (
    <section className="quote-section">
      <blockquote className="quote">
        <p className="quote__text">
          I built EchoVault because I wanted a journal that's smart—but doesn't judge.
          One that gives real insight—but doesn't leak my private thoughts to the cloud.
          Something personal, but powerful. EchoVault is that journal.
        </p>
        <footer className="quote__footer">
          <div className="quote__avatar">AK</div>
          <div className="quote__attribution">
            <cite className="quote__author">Aryan Kumar</cite>
            <span className="quote__role">Creator of EchoVault</span>
          </div>
        </footer>
      </blockquote>
    </section>
  )
}
