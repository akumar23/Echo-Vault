'use client'

import { createContext, useContext, ReactNode } from 'react'
import { MotionConfig } from 'framer-motion'
import { useReducedMotion } from './hooks/useReducedMotion'

interface MotionContextValue {
  reducedMotion: boolean
}

const MotionContext = createContext<MotionContextValue>({ reducedMotion: false })

export function useMotion() {
  return useContext(MotionContext)
}

interface MotionProviderProps {
  children: ReactNode
}

export function MotionProvider({ children }: MotionProviderProps) {
  const reducedMotion = useReducedMotion()

  return (
    <MotionContext.Provider value={{ reducedMotion }}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'never'}>
        {children}
      </MotionConfig>
    </MotionContext.Provider>
  )
}
