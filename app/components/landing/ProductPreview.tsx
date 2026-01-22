'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LayoutDashboard, PenLine, MessageCircle, BarChart3 } from 'lucide-react'

const tabs = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: LayoutDashboard,
    image: '/screenshots/dashboard.png',
    alt: 'EchoVault dashboard showing recent journal entries and mood overview',
    description: 'See your journal at a glance with mood trends and recent entries.',
  },
  {
    id: 'editor',
    label: 'Write',
    icon: PenLine,
    image: '/screenshots/editor.png',
    alt: 'EchoVault journal editor with AI writing suggestions',
    description: 'Write freely with an AI that suggests prompts and tracks your mood.',
  },
  {
    id: 'chat',
    label: 'Reflect',
    icon: MessageCircle,
    image: '/screenshots/chat.png',
    alt: 'EchoVault AI chat interface for reflections',
    description: 'Have meaningful conversations with an AI that knows your journal history.',
  },
  {
    id: 'insights',
    label: 'Insights',
    icon: BarChart3,
    image: '/screenshots/mood-chart.png',
    alt: 'EchoVault mood insights and pattern analysis',
    description: 'Discover patterns in your mood, topics, and writing over time.',
  },
]

export function ProductPreview() {
  const [activeTab, setActiveTab] = useState('dashboard')
  const activeContent = tabs.find((tab) => tab.id === activeTab)!

  return (
    <section className="product-preview" id="preview">
      <div className="product-preview__header">
        <h2 className="product-preview__title">See EchoVault in action</h2>
        <p className="product-preview__subtitle">
          A clean, distraction-free interface designed for reflection.
        </p>
      </div>

      <div className="product-preview__tabs">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`product-preview__tab ${activeTab === tab.id ? 'product-preview__tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            <tab.icon size={18} />
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div className="product-preview__content">
        <div className="product-preview__window">
          <div className="product-preview__window-header">
            <div className="product-preview__dots">
              <span></span>
              <span></span>
              <span></span>
            </div>
          </div>
          <Image
            src={activeContent.image}
            alt={activeContent.alt}
            width={1200}
            height={750}
            className="product-preview__image"
          />
        </div>
        <p className="product-preview__description">{activeContent.description}</p>
      </div>
    </section>
  )
}
