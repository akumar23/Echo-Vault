'use client'

import { useState } from 'react'
import Image from 'next/image'
import { LayoutDashboard, PenLine, MessageCircle, BarChart3 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, useMotion } from '@/components/motion'
import { MockMoodInsights } from './MockMoodInsights'

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
  const activeIndex = tabs.findIndex((tab) => tab.id === activeTab)
  const { reducedMotion } = useMotion()

  return (
    <section className="product-preview-new" id="preview">
      <FadeIn>
        <div className="product-preview-new__header">
          <h2 className="product-preview-new__title">See EchoVault in action</h2>
          <p className="product-preview-new__subtitle">
            A clean, distraction-free interface designed for reflection.
          </p>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="product-preview-new__tabs">
          {tabs.map((tab, index) => (
            <motion.button
              key={tab.id}
              className={`product-preview-new__tab ${activeTab === tab.id ? 'product-preview-new__tab--active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
              {activeTab === tab.id && (
                <motion.div
                  className="product-preview-new__tab-indicator"
                  layoutId="tab-indicator"
                  transition={{
                    type: 'spring',
                    stiffness: 500,
                    damping: 30,
                  }}
                />
              )}
            </motion.button>
          ))}
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <div className="product-preview-new__content">
          <div className="product-preview-new__frame">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={reducedMotion ? false : { opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reducedMotion ? undefined : { opacity: 0, x: -20 }}
                transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                className="product-preview-new__image-wrapper"
              >
                {activeTab === 'insights' ? (
                  <div className="product-preview-new__mock-container">
                    <MockMoodInsights />
                  </div>
                ) : (
                  <Image
                    src={activeContent.image}
                    alt={activeContent.alt}
                    width={1200}
                    height={750}
                    className="product-preview-new__image"
                  />
                )}
              </motion.div>
            </AnimatePresence>
            <div className="product-preview-new__glow" />
          </div>

          <AnimatePresence mode="wait">
            <motion.p
              key={activeTab}
              initial={reducedMotion ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="product-preview-new__description"
            >
              {activeContent.description}
            </motion.p>
          </AnimatePresence>
        </div>
      </FadeIn>

      <style jsx global>{`
        .product-preview-new {
          padding: var(--space-10) 0;
        }

        .product-preview-new__header {
          text-align: center;
          margin-bottom: var(--space-6);
        }

        .product-preview-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .product-preview-new__subtitle {
          color: var(--text-muted);
          font-size: var(--text-lg);
        }

        .product-preview-new__tabs {
          display: flex;
          justify-content: center;
          gap: var(--space-2);
          margin-bottom: var(--space-6);
          flex-wrap: wrap;
        }

        .product-preview-new__tab {
          position: relative;
          display: flex;
          align-items: center;
          gap: var(--space-2);
          padding: var(--space-3) var(--space-4);
          background: var(--glass-bg);
          backdrop-filter: var(--glass-blur-light);
          -webkit-backdrop-filter: var(--glass-blur-light);
          border: 1px solid var(--glass-border);
          border-radius: var(--radius-full);
          font-size: var(--text-sm);
          font-weight: 500;
          color: var(--text-muted);
          cursor: pointer;
          transition: color 0.2s ease, border-color 0.2s ease;
        }

        .product-preview-new__tab:hover {
          color: var(--text-primary);
          border-color: var(--border);
        }

        .product-preview-new__tab--active {
          color: var(--text-primary);
          border-color: var(--accent);
        }

        .product-preview-new__tab-indicator {
          position: absolute;
          inset: 0;
          background: var(--accent-subtle);
          border-radius: var(--radius-full);
          z-index: -1;
        }

        .product-preview-new__content {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: var(--space-5);
        }

        .product-preview-new__frame {
          position: relative;
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow:
            0 25px 50px -12px rgba(0, 0, 0, 0.12),
            0 0 0 1px var(--glass-border);
          max-width: 900px;
          width: 100%;
        }

        .product-preview-new__image-wrapper {
          position: relative;
        }

        .product-preview-new__image {
          display: block;
          width: 100%;
          height: auto;
        }

        .product-preview-new__mock-container {
          padding: var(--space-6);
          min-height: 500px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, rgba(26, 26, 26, 0.5) 0%, rgba(26, 26, 26, 0.8) 100%);
        }

        .product-preview-new__glow {
          position: absolute;
          inset: -100%;
          background: radial-gradient(
            circle at center,
            var(--accent) 0%,
            transparent 60%
          );
          opacity: 0.08;
          z-index: -1;
          pointer-events: none;
        }

        .product-preview-new__description {
          text-align: center;
          color: var(--text-muted);
          font-size: var(--text-base);
          max-width: 500px;
        }

        @media (max-width: 640px) {
          .product-preview-new__tabs {
            gap: var(--space-1);
          }

          .product-preview-new__tab {
            padding: var(--space-2) var(--space-3);
            font-size: var(--text-xs);
          }

          .product-preview-new__tab span {
            display: none;
          }
        }
      `}</style>
    </section>
  )
}
