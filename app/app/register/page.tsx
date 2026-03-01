'use client'

import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { getErrorMessage } from '@/lib/errors'
import { registerSchema, type RegisterFormData } from '@/lib/validation'
import { PasswordStrength } from '@/components/PasswordStrength'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [errors, setErrors] = useState<Partial<Record<keyof RegisterFormData, string>>>({})
  const { register } = useAuth()
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})
    setError('')

    // Validate with Zod
    const result = registerSchema.safeParse({ email, username, password })
    if (!result.success) {
      const fieldErrors: Partial<Record<keyof RegisterFormData, string>> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as keyof RegisterFormData] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    // Proceed with registration
    try {
      await register(result.data.email, result.data.username, result.data.password)
      router.push('/journal')
    } catch (err) {
      setError(getErrorMessage(err))
    }
  }

  return (
    <div className="container" style={{ maxWidth: '450px', marginTop: '10vh' }}>
      <div className="card card--accent">
        <h1 className="mb-6">Register</h1>

        <form onSubmit={handleSubmit}>
          {error && (
            <div className="alert alert--error mb-5">{error}</div>
          )}

          <div className="form-group">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-invalid={!!errors.email}
              aria-describedby={errors.email ? 'email-error' : undefined}
              required
            />
            {errors.email && (
              <p id="email-error" className="form-error">
                {errors.email}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              className="input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              aria-invalid={!!errors.username}
              aria-describedby={errors.username ? 'username-error' : undefined}
              required
            />
            {errors.username && (
              <p id="username-error" className="form-error">
                {errors.username}
              </p>
            )}
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              aria-invalid={!!errors.password}
              aria-describedby={errors.password ? 'password-error' : 'password-strength'}
              required
            />
            <div id="password-strength">
              <PasswordStrength password={password} />
            </div>
            {errors.password && (
              <p id="password-error" className="form-error">
                {errors.password}
              </p>
            )}
          </div>

          <button type="submit" className="btn btn-primary w-full">
            Register
          </button>
        </form>

        <p className="text-center mt-5 text-muted">
          Already have an account? <Link href="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
