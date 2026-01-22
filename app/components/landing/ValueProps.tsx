'use client'

import { Lock, Heart, MessageSquare, Search, Trash2, Settings } from 'lucide-react'

const props = [
  {
    icon: Lock,
    title: 'Write freely.',
    description: 'Your entries stay on your device or your private server. No tracking. No cloud sync. No surveillance.',
  },
  {
    icon: Heart,
    title: 'Track your emotional patterns.',
    description: "EchoVault automatically detects your mood from your writing—no tags needed. You'll start noticing patterns you've never seen before.",
  },
  {
    icon: MessageSquare,
    title: 'Get meaningful AI reflections.',
    description: 'After every entry, EchoVault gives thoughtful responses and insights. Ask questions, get suggestions, and revisit old thoughts—all connected and personal.',
  },
  {
    icon: Search,
    title: 'Find past entries by meaning.',
    description: 'Semantic search lets you find journal entries based on the idea, not the exact wording. "Feeling lost about my job" finds "I don\'t know what I\'m doing with my life."',
  },
  {
    icon: Trash2,
    title: 'Delete means delete.',
    description: 'You can permanently erase any entry and all associated AI memory—instantly and completely.',
  },
  {
    icon: Settings,
    title: 'Your stack, your choice.',
    description: "Use local models or any LLM provider that speaks OpenAI's API format. Configure your AI pipeline the way you want.",
  },
]

export function ValueProps() {
  return (
    <section className="value-props" id="why-echovault">
      <div className="value-props__header">
        <h2 className="value-props__title">Why EchoVault</h2>
      </div>
      <div className="value-props__grid">
        {props.map((prop) => (
          <div key={prop.title} className="value-prop">
            <div className="value-prop__icon">
              <prop.icon size={24} />
            </div>
            <h3 className="value-prop__title">{prop.title}</h3>
            <p className="value-prop__description">{prop.description}</p>
          </div>
        ))}
      </div>
    </section>
  )
}
