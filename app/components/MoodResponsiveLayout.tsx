'use client'

import { ReactNode } from 'react'
import { useMood, MoodProvider } from '@/contexts/MoodContext'
import { AmbientBackground } from './AmbientBackground'

interface MoodResponsiveContentProps {
  children: ReactNode
}

function MoodResponsiveContent({ children }: MoodResponsiveContentProps) {
  const { currentMood } = useMood()

  return (
    <div
      className="mood-responsive-container"
      data-mood-tint={currentMood ?? undefined}
    >
      <AmbientBackground mood={currentMood} />
      {children}
    </div>
  )
}

interface MoodResponsiveLayoutProps {
  children: ReactNode
}

export function MoodResponsiveLayout({ children }: MoodResponsiveLayoutProps) {
  return (
    <MoodProvider>
      <MoodResponsiveContent>
        {children}
      </MoodResponsiveContent>
    </MoodProvider>
  )
}
