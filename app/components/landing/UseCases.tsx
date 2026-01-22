'use client'

import { Heart, Shield, Users } from 'lucide-react'

const useCases = [
  {
    icon: Heart,
    title: 'Personal Journalers',
    description:
      'Daily reflection, gratitude practice, and mental wellness tracking. Your thoughts deserve a space that understands context and remembers patterns.',
    benefits: [
      'Track mood patterns over time',
      'Search past entries semantically',
      'Get AI reflections that understand you',
    ],
  },
  {
    icon: Shield,
    title: 'Privacy Advocates',
    description:
      'Your journal is deeply personal. EchoVault runs AI locally via Ollama—your words never touch external servers or cloud storage.',
    benefits: [
      'All AI processing on your machine',
      'No data collection or analytics',
      'True deletion when you want it',
    ],
  },
  {
    icon: Users,
    title: 'Therapists & Coaches',
    description:
      'Recommend to clients who want to maintain a reflective practice between sessions. Privacy-first design supports sensitive journaling.',
    benefits: [
      'Client data stays on their device',
      'Supports reflective practice',
      'No HIPAA compliance concerns',
    ],
  },
]

export function UseCases() {
  return (
    <section className="use-cases" id="use-cases">
      <div className="use-cases__header">
        <h2 className="use-cases__title">Built for people who value privacy</h2>
        <p className="use-cases__subtitle">
          Whether you&apos;re journaling for personal growth, mental health, or professional
          reflection, EchoVault adapts to your needs while keeping your data private.
        </p>
      </div>

      <div className="use-cases__grid">
        {useCases.map((useCase) => (
          <div key={useCase.title} className="use-case-card">
            <div className="use-case-card__icon">
              <useCase.icon size={24} />
            </div>
            <h3 className="use-case-card__title">{useCase.title}</h3>
            <p className="use-case-card__description">{useCase.description}</p>
            <ul className="use-case-card__benefits">
              {useCase.benefits.map((benefit) => (
                <li key={benefit}>{benefit}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
