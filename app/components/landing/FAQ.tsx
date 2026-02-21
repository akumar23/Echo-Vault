'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { FadeIn, StaggerContainer, StaggerItem, useMotion } from '@/components/motion'

const faqs = [
  {
    question: 'Is my data really private?',
    answer:
      'Yes. EchoVault is privacy-first by design. Your journal data stays in your own database with JWT authentication. You can use cloud LLM APIs for convenience or self-host with Ollama for complete local inference. We have no analytics and no way to access your data.',
  },
  {
    question: 'Do I need to install anything?',
    answer:
      'EchoVault works out of the box with cloud LLM APIs like OpenAI, Groq, or Together.ai—just add your API key. For self-hosting, you\'ll need Docker and optionally Ollama for local AI inference. Our setup guide walks you through either path in about 10 minutes.',
  },
  {
    question: 'Can I use my own LLM?',
    answer:
      'Absolutely. EchoVault supports any OpenAI-compatible API. Use cloud providers like OpenAI, Claude, Groq, or Together.ai, or run local models via Ollama, LM Studio, or vLLM. Configure generation and embedding models separately for maximum flexibility.',
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
    question: 'How does RAG and semantic search work?',
    answer:
      'When you write an entry, EchoVault generates vector embeddings and indexes them in PGVector. When you search or chat, your query is embedded and we find entries with similar semantic meaning—not just keyword matches. Time decay scoring ensures recent entries are weighted appropriately. This gives the AI human-like memory of your past writing.',
  },
]

function FAQItem({ faq, index, isOpen, onToggle }: {
  faq: typeof faqs[0]
  index: number
  isOpen: boolean
  onToggle: () => void
}) {
  const { reducedMotion } = useMotion()

  return (
    <motion.div
      className={`faq-item-new ${isOpen ? 'faq-item-new--open' : ''}`}
      layout={!reducedMotion}
    >
      <motion.button
        className="faq-item-new__question"
        onClick={onToggle}
        whileHover={{ x: 4 }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      >
        <span>{faq.question}</span>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={20} className="faq-item-new__icon" />
        </motion.div>
      </motion.button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            className="faq-item-new__answer"
            initial={reducedMotion ? false : { height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={reducedMotion ? undefined : { height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          >
            <p>{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null)

  const toggleFaq = (index: number) => {
    setOpenIndex(openIndex === index ? null : index)
  }

  return (
    <section className="faq-new" id="faq">
      <FadeIn>
        <div className="faq-new__header">
          <h2 className="faq-new__title">Frequently asked questions</h2>
          <p className="faq-new__subtitle">
            Everything you need to know about EchoVault.
          </p>
        </div>
      </FadeIn>

      <StaggerContainer className="faq-new__list" staggerDelay={0.05} delayChildren={0.1}>
        {faqs.map((faq, index) => (
          <StaggerItem key={faq.question}>
            <FAQItem
              faq={faq}
              index={index}
              isOpen={openIndex === index}
              onToggle={() => toggleFaq(index)}
            />
          </StaggerItem>
        ))}
      </StaggerContainer>

      <style jsx global>{`
        .faq-new {
          padding: var(--space-10) 0;
        }

        .faq-new__header {
          text-align: center;
          margin-bottom: var(--space-8);
        }

        .faq-new__title {
          font-size: var(--text-3xl);
          font-weight: 700;
          margin-bottom: var(--space-3);
        }

        .faq-new__subtitle {
          color: var(--text-muted);
          font-size: var(--text-lg);
        }

        .faq-new__list {
          max-width: 700px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          gap: var(--space-3);
        }

        .faq-item-new {
          background: var(--bg-surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          overflow: hidden;
          transition: border-color 0.2s ease;
        }

        .faq-item-new:hover {
          border-color: var(--border-light);
        }

        .faq-item-new--open {
          border-color: var(--accent-subtle);
        }

        .faq-item-new__question {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          padding: var(--space-4);
          background: none;
          border: none;
          text-align: left;
          font-size: var(--text-base);
          font-weight: 500;
          cursor: pointer;
          gap: var(--space-4);
        }

        .faq-item-new__icon {
          color: var(--text-muted);
          flex-shrink: 0;
        }

        .faq-item-new__answer {
          overflow: hidden;
        }

        .faq-item-new__answer p {
          padding: 0 var(--space-4) var(--space-4);
          color: var(--text-muted);
          font-size: var(--text-sm);
          line-height: 1.7;
        }
      `}</style>
    </section>
  )
}
