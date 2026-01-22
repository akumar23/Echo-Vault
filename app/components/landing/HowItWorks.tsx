'use client'

import { PenLine, Cpu, Sparkles } from 'lucide-react'

const steps = [
  {
    number: '1',
    icon: PenLine,
    title: 'Write your entry.',
    description: "Open EchoVault and write what's on your mind. No tags, no templates—just your raw thoughts.",
  },
  {
    number: '2',
    icon: Cpu,
    title: 'AI gets to work (quietly).',
    description: 'In the background, EchoVault analyzes your mood, embeds your entry for deep search, and prepares it for future insight. All without slowing you down.',
  },
  {
    number: '3',
    icon: Sparkles,
    title: 'Reflect, search, and grow.',
    description: "When you're ready, ask the AI to reflect on what you wrote. Search past entries by meaning. Track your mood over time. Let the insights unfold.",
  },
]

export function HowItWorks() {
  return (
    <section className="how-it-works" id="how-it-works">
      <div className="how-it-works__header">
        <h2 className="how-it-works__title">How It Works</h2>
        <p className="how-it-works__subtitle">
          Three simple steps to deeper self-understanding.
        </p>
      </div>

      <div className="how-it-works__steps">
        {steps.map((step, index) => (
          <div key={step.number} className="how-it-works__step">
            <div className="how-it-works__step-number">{step.number}</div>
            <div className="how-it-works__step-icon">
              <step.icon size={28} />
            </div>
            <h3 className="how-it-works__step-title">{step.title}</h3>
            <p className="how-it-works__step-description">{step.description}</p>
            {index < steps.length - 1 && (
              <div className="how-it-works__connector" />
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
