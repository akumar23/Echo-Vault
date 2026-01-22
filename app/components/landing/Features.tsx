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

function FeatureCard({ feature }: { feature: typeof features[0] }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className={`feature-card ${isExpanded ? 'feature-card--expanded' : ''}`}>
      <button
        className="feature-card__header"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <div className="feature-card__header-left">
          <div
            className="feature-card__icon"
            style={{ backgroundColor: `${feature.color}20`, color: feature.color }}
          >
            <feature.icon size={24} />
          </div>
          <div className="feature-card__titles">
            <span className="feature-card__emoji">{feature.emoji}</span>
            <h3 className="feature-card__title">{feature.title}</h3>
          </div>
        </div>
        <ChevronDown
          size={20}
          className={`feature-card__chevron ${isExpanded ? 'feature-card__chevron--open' : ''}`}
        />
      </button>

      <div className="feature-card__summary">
        <p>{feature.summary}</p>
      </div>

      <div className={`feature-card__details ${isExpanded ? 'feature-card__details--open' : ''}`}>
        <div className="feature-card__description">
          {feature.description.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </div>
    </div>
  )
}

export function Features() {
  return (
    <section className="features" id="features">
      <div className="features__header">
        <h2 className="features__title">Feature Highlights</h2>
        <p className="features__subtitle">
          Click each feature to learn more about how EchoVault helps you understand yourself better.
        </p>
      </div>

      <div className="features__grid">
        {features.map((feature) => (
          <FeatureCard key={feature.title} feature={feature} />
        ))}
      </div>
    </section>
  )
}
