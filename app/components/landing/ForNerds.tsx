'use client'

import Link from 'next/link'
import {
  Terminal,
  ArrowRight,
  Key,
  Server,
  Layers,
  Zap,
  Trash2,
  Cpu
} from 'lucide-react'

const features = [
  {
    icon: Key,
    title: 'Bring your own LLM',
    points: [
      'Works with anything that supports the OpenAI API format.',
      'Use ChatGPT, Gemini, Claude, Mistral, or any other model you have API access to.',
      'Drop in your own keys or route traffic through your own proxy/backend.',
    ],
  },
  {
    icon: Server,
    title: 'Go local, go hybrid, go wild',
    points: [
      'Supports local LLMs via Ollama, LM Studio, vLLM, LocalAI, etc.',
      'Want to use OpenAI for chat but keep your embeddings local? Totally fine.',
      "Everything's configurable—model endpoints, provider priorities, even fallbacks.",
    ],
  },
  {
    icon: Layers,
    title: 'Flexible embeddings',
    points: [
      'Choose from OpenAI embeddings or local models from HuggingFace or similar.',
      'Async processing via Celery so the app never slows down—even with big journals.',
    ],
  },
  {
    icon: Zap,
    title: 'Fast, streamed responses',
    points: [
      'Real-time reflections via WebSockets—no waiting for the AI to "finish thinking."',
      'Feels like a real-time chat, but smarter (and less forgetful).',
    ],
  },
  {
    icon: Trash2,
    title: 'Real deletion',
    points: [
      'Hard deletes wipe everything: content, embeddings, cached memory, semantic indexes.',
      'No shadow data. No "oops we kept that." When you say delete, we listen.',
    ],
  },
]

export function ForNerds() {
  return (
    <section className="for-nerds" id="for-nerds">
      <div className="for-nerds__header">
        <div className="for-nerds__badge">
          <Terminal size={14} />
          <span>For Developers</span>
        </div>
        <h2 className="for-nerds__title">For Nerds</h2>
        <p className="for-nerds__subtitle">
          EchoVault isn't just compatible with AI—it's modular by design.
          It's a journaling platform that AI plugs into, not the other way around.
        </p>
      </div>

      <div className="for-nerds__grid">
        {features.map((feature) => (
          <div key={feature.title} className="for-nerds__card">
            <div className="for-nerds__card-icon">
              <feature.icon size={24} />
            </div>
            <h3>{feature.title}</h3>
            <ul className="for-nerds__list">
              {feature.points.map((point, i) => (
                <li key={i}>{point}</li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="for-nerds__tldr">
        <div className="for-nerds__tldr-icon">
          <Cpu size={24} />
        </div>
        <div className="for-nerds__tldr-content">
          <h3>TL;DR</h3>
          <p>
            EchoVault is the journaling OS. LLMs are plugins. You pick the model.
            You pick the stack. We just make it work.
          </p>
        </div>
      </div>

      <div className="for-nerds__cta">
        <Link href="/docs" className="btn btn-secondary">
          Read the Full Documentation
          <ArrowRight size={16} />
        </Link>
      </div>
    </section>
  )
}
