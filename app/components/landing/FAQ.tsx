'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'

const faqs = [
  {
    question: 'Is my data really private?',
    answer:
      'Yes. EchoVault is self-hosted, meaning all your journal data stays on your own machine or server. The AI runs locally via Ollama—your entries never leave your device. We have no servers, no analytics, and no way to access your data.',
  },
  {
    question: 'Do I need to install anything?',
    answer:
      'You\'ll need Docker to run EchoVault and Ollama for local AI inference. Our setup guide walks you through the process in about 10 minutes. If you prefer, you can also connect to any OpenAI-compatible API instead of running AI locally.',
  },
  {
    question: 'Can I use my own LLM?',
    answer:
      'Absolutely. EchoVault supports any OpenAI-compatible API. You can use local models via Ollama (like Llama 3.1), or connect to external providers like OpenAI, Groq, Together.ai, or LM Studio. Configure generation and embedding models separately.',
  },
  {
    question: 'What if I want to delete everything?',
    answer:
      'EchoVault supports true deletion—not just "soft delete" where data lingers in backups. When you delete an entry or your entire account, the data is actually removed from the database. Your right to be forgotten is respected.',
  },
  {
    question: 'Is it really free?',
    answer:
      'Yes, EchoVault is free and open source under the MIT license. There are no premium tiers, no feature gates, no subscriptions. You can use it, modify it, and even contribute to its development.',
  },
  {
    question: 'How does semantic search work?',
    answer:
      'When you write an entry, EchoVault generates an embedding (a numerical representation of meaning) using your configured model. When you search, your query is also embedded, and we find entries with similar meanings—not just keyword matches. This means searching "feeling overwhelmed at work" will find entries about job stress even if you used different words.',
  },
]

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="faq" id="faq">
      <div className="faq__header">
        <h2 className="faq__title">Frequently asked questions</h2>
        <p className="faq__subtitle">
          Everything you need to know about EchoVault.
        </p>
      </div>

      <div className="faq__list">
        {faqs.map((faq, index) => (
          <div
            key={faq.question}
            className={`faq__item ${openIndex === index ? 'faq__item--open' : ''}`}
          >
            <button className="faq__question" onClick={() => toggleFaq(index)}>
              <span>{faq.question}</span>
              <ChevronDown
                size={20}
                className={`faq__icon ${openIndex === index ? 'faq__icon--rotated' : ''}`}
              />
            </button>
            <div className="faq__answer">
              <p>{faq.answer}</p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
