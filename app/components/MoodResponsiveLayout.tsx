'use client'

import { ReactNode } from 'react'
import { MoodProvider } from '@/contexts/MoodContext'

/**
 * MoodResponsiveLayout — provides mood context to the tree.
 *
 * Previously this also mounted <AmbientBackground /> globally; we now only
 * render AmbientBackground on the /journal page to keep writing surfaces
 * distraction-free. Downstream consumers can still read mood via useMood().
 */
export function MoodResponsiveLayout({ children }: { children: ReactNode }) {
  return <MoodProvider>{children}</MoodProvider>
}
