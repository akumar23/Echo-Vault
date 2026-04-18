'use client'

import { useMemo } from 'react'

interface PasswordStrengthProps {
  password: string
}

type StrengthLevel = 'weak' | 'fair' | 'good' | 'strong'

interface StrengthResult {
  level: StrengthLevel
  label: string
  score: number
}

function calculateStrength(password: string): StrengthResult {
  if (!password) {
    return { level: 'weak', label: '', score: 0 }
  }

  let score = 0
  const checks = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password),
    longLength: password.length >= 12,
  }

  if (checks.length) score++
  if (checks.uppercase) score++
  if (checks.lowercase) score++
  if (checks.number) score++
  if (checks.special) score++
  if (checks.longLength) score++

  if (score <= 2) {
    return { level: 'weak', label: 'Weak - add more characters', score }
  } else if (score <= 3) {
    return { level: 'fair', label: 'Fair - try adding numbers or symbols', score }
  } else if (score <= 4) {
    return { level: 'good', label: 'Good', score }
  } else {
    return { level: 'strong', label: 'Strong', score }
  }
}

/**
 * Password strength indicator with visual bar and label.
 * Shows strength level based on length, character variety, and complexity.
 */
export function PasswordStrength({ password }: PasswordStrengthProps) {
  const strength = useMemo(() => calculateStrength(password), [password])

  if (!password) return null

  const widths: Record<StrengthLevel, string> = {
    weak: 'w-1/4',
    fair: 'w-1/2',
    good: 'w-3/4',
    strong: 'w-full',
  }

  const colors: Record<StrengthLevel, string> = {
    weak: 'bg-destructive',
    fair: 'bg-[color:var(--warning)]',
    good: 'bg-primary',
    strong: 'bg-[color:var(--success)]',
  }

  const labelColors: Record<StrengthLevel, string> = {
    weak: 'text-destructive',
    fair: 'text-[color:var(--warning)]',
    good: 'text-primary',
    strong: 'text-[color:var(--success)]',
  }

  return (
    <div className="mt-2" aria-live="polite">
      <div className="mb-1 h-1 overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full transition-all duration-200 ${widths[strength.level]} ${colors[strength.level]}`}
        />
      </div>
      <span className={`text-xs ${labelColors[strength.level]}`}>
        {strength.label}
      </span>
    </div>
  )
}
