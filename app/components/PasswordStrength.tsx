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

  return (
    <div className="password-strength" aria-live="polite">
      <div className="password-strength__bar">
        <div className={`password-strength__fill password-strength__fill--${strength.level}`} />
      </div>
      <span className={`password-strength__label password-strength__label--${strength.level}`}>
        {strength.label}
      </span>
    </div>
  )
}
