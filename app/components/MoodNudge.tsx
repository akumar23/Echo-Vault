'use client'

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useEntries } from '@/hooks/useEntries'
import { useInsightVoice, InsightVoice, getPhrase } from '@/contexts/InsightVoiceContext'
import Link from 'next/link'
import { PenLine, X, Sparkles, HelpCircle, Lightbulb, Link2 } from 'lucide-react'
import { promptsApi, WritingSuggestion } from '@/lib/api'

const FALLBACK_PROMPTS: WritingSuggestion[] = [
  {
    id: 'fallback-1',
    text: "What's one small thing that brought you comfort today?",
    type: 'question',
    context: 'Daily reflection',
  },
  {
    id: 'fallback-2',
    text: "Write about a moment today when you felt at peace.",
    type: 'prompt',
    context: 'Mindfulness',
  },
  {
    id: 'fallback-3',
    text: "What would make tomorrow a little better?",
    type: 'question',
    context: 'Future focus',
  },
]

const NUDGE_MESSAGES: Record<InsightVoice, string[]> = {
  gentle: [
    "Feeling heavy lately?",
    "It's been a tough stretch.",
    "Some days are harder than others.",
    "Your feelings are valid.",
    "Writing can help process emotions.",
  ],
  direct: [
    "Mood's been low.",
    "Tough period detected.",
    "Time to process.",
    "Check in with yourself.",
    "Journal it out.",
  ],
  playful: [
    "Hey, rough patch? Let's work through it together",
    "Sending virtual hugs! Want to write about it?",
    "Even cloudy days need journaling",
    "Let's turn that frown upside down!",
    "Brain dump time? I'm here for it",
  ],
}

const TYPE_ICONS = {
  question: HelpCircle,
  prompt: Lightbulb,
  continuation: Link2,
}

const TYPE_LABELS = {
  question: 'Question',
  prompt: 'Prompt',
  continuation: 'Follow-up',
}

interface MoodAnalysis {
  isLowMood: boolean
  recentAvg: number | null
  historicalAvg: number | null
  daysSinceLastEntry: number | null
  shouldShowNudge: boolean
}

export function MoodNudge() {
  const { data: entries } = useEntries(0, 20)
  const { voice } = useInsightVoice()
  const [isDismissed, setIsDismissed] = useState(false)
  const [suggestions, setSuggestions] = useState<WritingSuggestion[]>(FALLBACK_PROMPTS)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [messageIndex, setMessageIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [preferredType, setPreferredType] = useState<string | null>(null)
  const hasLoggedDisplay = useRef(false)

  // Fetch AI suggestions on mount
  useEffect(() => {
    const fetchSuggestions = async () => {
      try {
        const response = await promptsApi.getSuggestions()
        if (response.suggestions.length > 0) {
          setSuggestions(response.suggestions)
          setPreferredType(response.preferred_type)
        }
      } catch (error) {
        console.error('Failed to fetch suggestions:', error)
        // Keep fallback prompts
      } finally {
        setIsLoading(false)
      }
    }

    fetchSuggestions()
    setMessageIndex(Math.floor(Math.random() * NUDGE_MESSAGES.gentle.length))
  }, [])

  const analysis = useMemo((): MoodAnalysis => {
    if (!entries || entries.length < 3) {
      return {
        isLowMood: false,
        recentAvg: null,
        historicalAvg: null,
        daysSinceLastEntry: null,
        shouldShowNudge: false,
      }
    }

    const moods = entries
      .map(e => e.mood_user ?? e.mood_inferred)
      .filter((m): m is number => m !== null)

    if (moods.length < 3) {
      return {
        isLowMood: false,
        recentAvg: null,
        historicalAvg: null,
        daysSinceLastEntry: null,
        shouldShowNudge: false,
      }
    }

    const recentMoods = moods.slice(0, 3)
    const recentAvg = recentMoods.reduce((a, b) => a + b, 0) / recentMoods.length
    const historicalAvg = moods.reduce((a, b) => a + b, 0) / moods.length

    const lastEntry = entries[0]
    const daysSinceLastEntry = lastEntry
      ? Math.floor((Date.now() - new Date(lastEntry.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : null

    const isLowMood = recentAvg < 2.5 || (recentAvg < historicalAvg - 0.5)
    const shouldShowNudge = isLowMood || (daysSinceLastEntry !== null && daysSinceLastEntry >= 2 && recentAvg < 3)

    return {
      isLowMood,
      recentAvg,
      historicalAvg,
      daysSinceLastEntry,
      shouldShowNudge,
    }
  }, [entries])

  // Log display interaction once when nudge is shown
  useEffect(() => {
    if (analysis.shouldShowNudge && !isDismissed && !isLoading && !hasLoggedDisplay.current) {
      const currentSuggestion = suggestions[currentIndex]
      if (currentSuggestion) {
        hasLoggedDisplay.current = true
        promptsApi.logInteraction({
          prompt_text: currentSuggestion.text,
          prompt_type: currentSuggestion.type,
          action: 'displayed',
          source_entry_id: currentSuggestion.source_entry_id,
        }).catch(console.error)
      }
    }
  }, [analysis.shouldShowNudge, isDismissed, isLoading, suggestions, currentIndex])

  const handleNewPrompt = useCallback(() => {
    const currentSuggestion = suggestions[currentIndex]

    // Log cycle interaction
    if (currentSuggestion) {
      promptsApi.logInteraction({
        prompt_text: currentSuggestion.text,
        prompt_type: currentSuggestion.type,
        action: 'cycled',
        source_entry_id: currentSuggestion.source_entry_id,
      }).catch(console.error)
    }

    setCurrentIndex((prev) => (prev + 1) % suggestions.length)

    // Log display for the new suggestion
    const nextIndex = (currentIndex + 1) % suggestions.length
    const nextSuggestion = suggestions[nextIndex]
    if (nextSuggestion) {
      promptsApi.logInteraction({
        prompt_text: nextSuggestion.text,
        prompt_type: nextSuggestion.type,
        action: 'displayed',
        source_entry_id: nextSuggestion.source_entry_id,
      }).catch(console.error)
    }
  }, [suggestions, currentIndex])

  const handleDismiss = useCallback(() => {
    const currentSuggestion = suggestions[currentIndex]

    // Log dismiss interaction
    if (currentSuggestion) {
      promptsApi.logInteraction({
        prompt_text: currentSuggestion.text,
        prompt_type: currentSuggestion.type,
        action: 'dismissed',
        source_entry_id: currentSuggestion.source_entry_id,
      }).catch(console.error)
    }

    setIsDismissed(true)
  }, [suggestions, currentIndex])

  const handleClick = useCallback(() => {
    const currentSuggestion = suggestions[currentIndex]

    // Log click interaction
    if (currentSuggestion) {
      promptsApi.logInteraction({
        prompt_text: currentSuggestion.text,
        prompt_type: currentSuggestion.type,
        action: 'clicked',
        source_entry_id: currentSuggestion.source_entry_id,
      }).catch(console.error)
    }
  }, [suggestions, currentIndex])

  // Don't show if dismissed, conditions not met, or still loading
  if (isDismissed || !analysis.shouldShowNudge || isLoading) {
    return null
  }

  const messages = NUDGE_MESSAGES[voice]
  const nudgeMessage = messages[messageIndex % messages.length]
  const currentSuggestion = suggestions[currentIndex]
  const buttonText = getPhrase('actions', 'writeNow', voice)

  const TypeIcon = TYPE_ICONS[currentSuggestion.type]
  const typeLabel = TYPE_LABELS[currentSuggestion.type]
  const isPreferred = preferredType === currentSuggestion.type

  // Build URL with prompt and metadata
  const promptUrl = `/new?prompt=${encodeURIComponent(currentSuggestion.text)}&promptType=${currentSuggestion.type}${currentSuggestion.source_entry_id ? `&sourceEntryId=${currentSuggestion.source_entry_id}` : ''}`

  return (
    <div className="mood-nudge">
      <div className="mood-nudge__header">
        <span className="mood-nudge__icon">💭</span>
        <span className="mood-nudge__message">{nudgeMessage}</span>
      </div>

      <button
        className="mood-nudge__dismiss"
        onClick={handleDismiss}
        aria-label="Not now"
        title="Not now"
      >
        Not now
      </button>

      <div className="mood-nudge__prompt">
        <div className="mood-nudge__prompt-meta">
          <span className="mood-nudge__prompt-type">
            <TypeIcon size={12} />
            {currentSuggestion.context}
          </span>
          {isPreferred && <span className="mood-nudge__preferred">Works for you</span>}
        </div>
        <p className="mood-nudge__prompt-text">"{currentSuggestion.text}"</p>
        <button
          className="mood-nudge__new-prompt"
          onClick={handleNewPrompt}
          aria-label="Get new prompt"
        >
          <Sparkles size={12} />
          New suggestion
        </button>
      </div>

      <Link
        href={promptUrl}
        className="mood-nudge__write-btn"
        onClick={handleClick}
        title={buttonText}
      >
        <PenLine size={14} />
        {buttonText}
      </Link>
    </div>
  )
}
