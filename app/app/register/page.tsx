'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getErrorMessage } from '@/lib/errors'
import { registerSchema, type RegisterFormData } from '@/lib/validation'
import { PasswordStrength } from '@/components/PasswordStrength'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

/**
 * Register — editorial, no card chrome.
 */
export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<
    Partial<Record<keyof RegisterFormData, string>>
  >({})
  const [submitting, setSubmitting] = useState(false)
  const { register } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})
    setFormError('')

    const result = registerSchema.safeParse({ email, username, password })
    if (!result.success) {
      const errors: Partial<Record<keyof RegisterFormData, string>> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          errors[err.path[0] as keyof RegisterFormData] = err.message
        }
      })
      setFieldErrors(errors)
      return
    }

    setSubmitting(true)
    try {
      await register(
        result.data.email,
        result.data.username,
        result.data.password,
      )
      router.push('/journal')
    } catch (err) {
      setFormError(getErrorMessage(err))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center px-6 py-12">
      <div className="mb-8 flex flex-col items-center gap-3">
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-foreground text-background">
          <span className="text-xs font-bold">EV</span>
        </span>
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Create your account
          </h1>
          <p className="text-sm text-muted-foreground">
            A private journal that remembers you.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate className="space-y-5">
        {formError && (
          <Alert variant="destructive">
            <AlertDescription>{formError}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!fieldErrors.email}
            aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            required
            autoComplete="email"
          />
          {fieldErrors.email && (
            <p id="email-error" className="text-sm text-destructive">
              {fieldErrors.email}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="username">Username</Label>
          <Input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            aria-invalid={!!fieldErrors.username}
            aria-describedby={
              fieldErrors.username ? 'username-error' : undefined
            }
            required
            autoComplete="username"
          />
          {fieldErrors.username && (
            <p id="username-error" className="text-sm text-destructive">
              {fieldErrors.username}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={!!fieldErrors.password}
            aria-describedby={
              fieldErrors.password ? 'password-error' : 'password-strength'
            }
            required
            autoComplete="new-password"
          />
          <div id="password-strength">
            <PasswordStrength password={password} />
          </div>
          {fieldErrors.password && (
            <p id="password-error" className="text-sm text-destructive">
              {fieldErrors.password}
            </p>
          )}
        </div>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? 'Creating account...' : 'Create account'}
        </Button>

        <p className="text-center text-sm text-muted-foreground">
          Already have an account?{' '}
          <Link
            href="/login"
            className="font-medium text-foreground underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
