'use client'

import { useState } from 'react'
import {
  Brain,
  Search,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  Trash2,
  Settings,
  ChevronDown
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, useMotion } from '@/components/motion'

const features = [
  {
    icon: Brain,
    emoji: '🧠',
    title: 'Mood Tracking',
    summary: 'EchoVault reads between the lines and automatically detects your emotional tone.',
    description: `EchoVault reads between the lines. Every time you journal, it automatically detects your emotional tone—without you needing to tag anything. After a few weeks, you'll see surprising patterns emerge: recurring stress days, emotional triggers, or even subtle improvements in your mood.`,
    color: 'var(--mood-4)',
  },
  {
    icon: Search,
    emoji: '🔍',
    title: 'Semantic Search',
    summary: 'Search by meaning, not keywords. Find entries based on what you meant.',
    description: `Forget keyword search. EchoVault converts your entries into dense, high-dimensional embeddings that represent meaning. You can search for "feeling stuck in life" and it'll find that entry where you said "I feel like I'm running in circles," even if the words don't match. It's search that understands what you meant.`,
    color: 'var(--accent)',
  },
  {
    icon: MessageSquare,
    emoji: '💬',
    title: 'AI Reflections',
    summary: 'Get real-time, thoughtful responses that reference your past writing.',
    description: `After you write, EchoVault can reflect on your entry in real-time. It streams the response word by word—like a thoughtful friend typing out their reply. You can ask follow-up questions, explore your thoughts further, or just sit with the insight.

The best part? The AI remembers your past writing. It can say things like "This sounds similar to how you were feeling in March," and actually link back to that entry. It has context—because it's your journal, not a chatbot with amnesia.`,
    color: 'var(--accent-secondary)',
  },
  {
    icon: Lightbulb,
    emoji: '✍️',
    title: 'Writing Suggestions',
    summary: "Never stare at a blank page again. Get prompts based on your history.",
    description: `Not sure what to write? EchoVault can suggest prompts based on your past entries, mood patterns, or recurring topics. You'll never stare at a blank page again. It's like journaling with a coach who knows your emotional history.`,
    color: 'var(--warning)',
  },
  {
    icon: TrendingUp,
    emoji: '📊',
    title: 'Life Pattern Insights',
    summary: 'Zoom out and see big-picture trends in your emotional life.',
    description: `EchoVault zooms out and gives you big-picture reflections. It can detect recurring themes, emotional cycles, or personal growth trends. "You've mentioned burnout 5 times in the past 10 entries." Or: "You tend to feel better after writing in the morning." Little insights, big impact.`,
    color: 'var(--success)',
  },
  {
    icon: Trash2,
    emoji: '🗑',
    title: 'Forgetting / Deletion',
    summary: 'Two levels of deletion: recoverable soft delete or permanent hard delete.',
    description: `Sometimes you want to delete something—and mean it. EchoVault gives you two options:

• Soft delete – Recoverable in case you change your mind.

• Hard delete – Total erasure. The entry, the embeddings, the AI memory—it's all gone. No backups, no second chances. Full control.`,
    color: 'var(--error)',
  },
  {
    icon: Settings,
    emoji: '⚙️',
    title: 'Flexible LLM Setup',
    summary: "Use local models, cloud APIs, or mix and match. Your journal, your rules.",
    description: `EchoVault isn't tied to any one AI provider. You can use:

• Local models with Ollama, LM Studio, vLLM, or anything else OpenAI-compatible.

• Cloud models like ChatGPT, Gemini, or Claude via your own API key.

• Custom servers if you're running your own GPU rig or backend.

Mix and match: use local for embeddings and cloud for chat—or go full offline. Your journal, your models, your rules.`,
    color: 'var(--text-muted)',
  },
]

function FeatureCard({ feature, index }: { feature: typeof features[0]; index: number }) {
  const [isExpanded, setIsExpanded] = useState(false)
  const { reducedMotion } = useMotion()

  return (
    <motion.div
      className="feature-card-new"
      layout={!reducedMotion}
      style={{
        borderLeftColor: feature.color,
      }}
    >
      <motion.button
        className="feature-card-new__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        whileHover={{ x: 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <div className="feature-card-new__header-left">
          <motion.div
            className="feature-card-new__icon"
            style={{
              backgroundColor: `color-mix(in srgb, ${feature.color} 15%, transparent)`,
              color: feature.color,
            }}
            animate={isExpanded ? { scale: 1.1 } : { scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
          >
            <feature.icon size={22} />
          </motion.div>
          <div className="feature-card-new__titles">
            <span className="feature-card-new__emoji">{feature.emoji}</span>
            <h3 className="feature-card-new__title">{feature.title}</h3>
          </div>
        </div>
        <motion.div
          animate={{ rotate: isExpanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className="feature-card-new__chevron" />
        </motion.div>
      </motion.button>

      <p className="feature-card-new__summary">{feature.summary}</p>

      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            className="feature-card-new__details"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <div className="feature-card-new__description">
              {feature.description.split('\n\n').map((paragraph, i) => (
                <motion.p
                  key={i}
                  initial={reducedMotion ? false : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {paragraph}
                </motion.p>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function Features() {
  return (
    <section className="features-new" id="features">
      <FadeIn>
        <div className="features-new__header">
          <h2 className="features-new__title">Feature Highlights</h2>
          <p className="features-new__subtitle">
            Click each feature to learn more about how EchoVault helps you understand yourself better.
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="features-new__grid" staggerDelay={0.06} delayChildren={0.1}>
        {features.map((feature, index) => (
          <StaggerItem key={feature.title}>
            <FeatureCard feature={feature} index={index} />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <style jsx global>{`
        .features-new {
          padding: var(--space-10) 0;
        }

        .features-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .features-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .features-new__subtitle {
          color: var(--text-muted);
          font-size: var(--text-lg);
          max-width: 600px;
          margin: 0 auto;
        }

        .features-new__grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
          gap: var(--space-4);
        }

        .feature-card-new {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-left: 3px solid var(--accent);
          border-radius: var(--radius-md);
          padding: var(--space-4);
          transition: box-shadow 0.2s ease, border-color 0.2s ease;
        }

        .feature-card-new:hover {
          box-shadow: var(--shadow-md);
        }

        .feature-card-new__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          background: none;
          border: none;
          padding: 0;
          cursor: pointer;
          text-align: left;
        }

        .feature-card-new__header-left {
          display: flex;
          align-items: center;
          gap: var(--space-3);
        }

        .feature-card-new__icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 44px;
          height: 44px;
          border-radius: var(--radius-md);
          flex-shrink: 0;
        }

        .feature-card-new__titles {
          display: flex;
          align-items: center;
          gap: var(--space-2);
        }

        .feature-card-new__emoji {
          font-size: var(--text-lg);
        }

        .feature-card-new__title {
          font-size: var(--text-base);
          font-weight: 600;
        }

        .feature-card-new__chevron {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .feature-card-new__summary {
          color: var(--text-muted);
          font-size: var(--text-sm);
          margin-top: var(--space-3);
          line-height: 1.5;
        }

        .feature-card-new__details {
          overflow: hidden;
        }

        .feature-card-new__description {
          padding-top: var(--space-4);
          border-top: 1px solid var(--border);
          margin-top: var(--space-4);
        }

        .feature-card-new__description p {
          color: var(--text-primary);
          font-size: var(--text-sm);
          line-height: 1.7;
          margin-bottom: var(--space-3);
        }

        .feature-card-new__description p:last-child {
          margin-bottom: 0;
        }

        @media (max-width: 640px) {
          .features-new__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </section>
  )
}
