'use client'

import { createContext, useContext, useSyncExternalStore, ReactNode } from 'react'

export type InsightVoice = 'gentle' | 'direct' | 'playful'

interface InsightVoiceContextValue {
  voice: InsightVoice
  setVoice: (voice: InsightVoice) => void
}

const InsightVoiceContext = createContext<InsightVoiceContextValue>({
  voice: 'gentle',
  setVoice: () => {},
})

export function useInsightVoice() {
  return useContext(InsightVoiceContext)
}

// Voice-specific phrasing transformations
export const voicePhrases = {
  // Greeting messages
  greetings: {
    gentle: {
      streak: "You've been on a great streak lately",
      doingWell: "Glad to see you're doing well",
      lookingUp: "Things seem to be looking up",
      oneDay: "Take it one day at a time",
      howsDay: "How's your day going?",
      progress: "You're making progress. Keep going",
      newDay: "A new day, a fresh start",
      writeHelp: "Writing can help. Take your time",
      readyStart: "Ready to start your journaling journey?",
      beenAwhile: "It's been a few days. How are you feeling?",
    },
    direct: {
      streak: "Strong momentum this week",
      doingWell: "Mood's been solid",
      lookingUp: "Trending upward",
      oneDay: "Rough patch. That's okay.",
      howsDay: "Current status?",
      progress: "Progress noted. Continue.",
      newDay: "New day. New start.",
      writeHelp: "Try writing it out.",
      readyStart: "Let's begin.",
      beenAwhile: "Been a few days. Check in?",
    },
    playful: {
      streak: "Look at you go! On fire lately! 🔥",
      doingWell: "Vibes are immaculate ✨",
      lookingUp: "Plot twist: things are getting better!",
      oneDay: "Tough day? We've all been there 💪",
      howsDay: "What's the vibe today?",
      progress: "Hey, progress is progress! 🌱",
      newDay: "Rise and shine! ☀️",
      writeHelp: "Let it out, friend. I'm here 💭",
      readyStart: "Ready to spill the tea? 🍵",
      beenAwhile: "Missed you! How's it going? 👋",
    },
  },
  // Mood insight messages
  insights: {
    gentle: {
      moodUp: "Your mood has been improving",
      moodDown: "You've been feeling heavier lately",
      bestDay: "peaks on",
      journalStreak: "day journaling streak",
      moreEntries: "more entries than last week",
      fewerEntries: "fewer entries than last week",
    },
    direct: {
      moodUp: "Mood up",
      moodDown: "Mood down",
      bestDay: "Best day:",
      journalStreak: "-day streak",
      moreEntries: "more vs last week",
      fewerEntries: "fewer vs last week",
    },
    playful: {
      moodUp: "Mood glow-up! 📈",
      moodDown: "Sending virtual hugs 🫂",
      bestDay: "Your power day is",
      journalStreak: "days in a row! 🏆",
      moreEntries: "extra entries this week! 💪",
      fewerEntries: "fewer entries (self-care break?) 🧘",
    },
  },
  // Action prompts
  actions: {
    gentle: {
      writeNow: "Start Writing",
      reflect: "Reflect",
      viewMore: "View More",
    },
    direct: {
      writeNow: "Write",
      reflect: "Analyze",
      viewMore: "More",
    },
    playful: {
      writeNow: "Let's Go! ✏️",
      reflect: "Deep Dive 🔍",
      viewMore: "Show Me More! 👀",
    },
  },
}

// Helper function to get phrase based on voice
export function getPhrase(
  category: keyof typeof voicePhrases,
  key: string,
  voice: InsightVoice
): string {
  const phrases = voicePhrases[category]
  if (phrases && phrases[voice] && (phrases[voice] as Record<string, string>)[key]) {
    return (phrases[voice] as Record<string, string>)[key]
  }
  // Fallback to gentle voice
  if (phrases?.gentle && (phrases.gentle as Record<string, string>)[key]) {
    return (phrases.gentle as Record<string, string>)[key]
  }
  return key
}

interface InsightVoiceProviderProps {
  children: ReactNode
}

const STORAGE_KEY = 'echocault-insight-voice'
const VOICE_CHANGE_EVENT = 'echocault-insight-voice-change'

const subscribeVoice = (callback: () => void) => {
  window.addEventListener('storage', callback)
  window.addEventListener(VOICE_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(VOICE_CHANGE_EVENT, callback)
  }
}

const getVoiceSnapshot = (): InsightVoice => {
  const stored = localStorage.getItem(STORAGE_KEY) as InsightVoice | null
  return stored && ['gentle', 'direct', 'playful'].includes(stored) ? stored : 'gentle'
}

const getVoiceServerSnapshot = (): InsightVoice => 'gentle'

export function InsightVoiceProvider({ children }: InsightVoiceProviderProps) {
  const voice = useSyncExternalStore(
    subscribeVoice,
    getVoiceSnapshot,
    getVoiceServerSnapshot,
  )

  const setVoice = (newVoice: InsightVoice) => {
    localStorage.setItem(STORAGE_KEY, newVoice)
    window.dispatchEvent(new Event(VOICE_CHANGE_EVENT))
  }

  return (
    <InsightVoiceContext.Provider value={{ voice, setVoice }}>
      {children}
    </InsightVoiceContext.Provider>
  )
}
