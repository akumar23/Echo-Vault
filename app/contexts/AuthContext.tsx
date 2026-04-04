'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi, User } from '@/lib/api'

interface AuthContextType {
  user: User | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => Promise<void>
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Restore session on mount by calling /auth/me.
  // The access_token cookie is sent automatically. If expired, the axios interceptor
  // transparently refreshes it via /auth/refresh before retrying.
  useEffect(() => {
    authApi.getMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const login = async (email: string, password: string) => {
    await authApi.login(email, password)      // Sets access_token + refresh_token cookies
    const userData = await authApi.getMe()
    setUser(userData)
  }

  const register = async (email: string, username: string, password: string) => {
    await authApi.register(email, username, password)
    await login(email, password)
  }

  const logout = async () => {
    try {
      await authApi.logout()  // Revokes refresh token server-side + clears cookies
    } finally {
      setUser(null)
    }
  }

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
