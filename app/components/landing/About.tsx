'use client'

import { Heart } from 'lucide-react'

export function About() {
  return (
    <section className="about" id="about">
      <div className="about__content">
        <div className="about__icon">
          <Heart size={32} />
        </div>

        <h2 className="about__title">Why I built EchoVault</h2>

        <div className="about__text">
          <p>
            I started journaling years ago as a way to process my thoughts and track my mental
            health. But every app I tried either felt like it was harvesting my data, or lacked
            the intelligent features that could actually help me understand patterns in my life.
          </p>

          <p>
            When local LLMs became viable through Ollama, I saw an opportunity: what if journaling
            could be both private <em>and</em> intelligent? What if AI could help you reflect
            without your most personal thoughts ever leaving your device?
          </p>

          <p>
            EchoVault is the result—a journal that respects your privacy while giving you the
            tools to understand yourself better. It&apos;s open source because I believe everyone
            deserves access to private, intelligent journaling.
          </p>
        </div>

        <div className="about__author">
          <div className="about__avatar">AK</div>
          <div className="about__author-info">
            <span className="about__author-name">Aryan Kumar</span>
            <span className="about__author-role">Creator of EchoVault</span>
          </div>
        </div>
      </div>
    </section>
  )
}
