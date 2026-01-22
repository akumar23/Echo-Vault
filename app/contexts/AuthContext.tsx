'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
import { authApi, User } from '@/lib/api'

interface AuthContextType {
  user: User | null
  token: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, username: string, password: string) => Promise<void>
  logout: () => void
  loading: boolean
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Helper to set cookie (for middleware auth check)
function setTokenCookie(token: string) {
  document.cookie = `token=${token}; path=/; max-age=${60 * 60 * 24 * 7}; SameSite=Lax`
}

// Helper to remove cookie
function removeTokenCookie() {
  document.cookie = 'token=; path=/; max-age=0'
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedToken = localStorage.getItem('token')
    if (storedToken) {
      setToken(storedToken)
      setTokenCookie(storedToken) // Sync cookie with localStorage
      authApi.getMe()
        .then((userData) => {
          setUser(userData)
        })
        .catch(() => {
          localStorage.removeItem('token')
          removeTokenCookie()
          setToken(null)
        })
        .finally(() => setLoading(false))
    } else {
      removeTokenCookie() // Ensure cookie is cleared if no localStorage token
      setLoading(false)
    }
  }, [])

  const login = async (email: string, password: string) => {
    const response = await authApi.login(email, password)
    const newToken = response.access_token
    localStorage.setItem('token', newToken)
    setTokenCookie(newToken)
    setToken(newToken)
    const userData = await authApi.getMe()
    setUser(userData)
  }

  const register = async (email: string, username: string, password: string) => {
    await authApi.register(email, username, password)
    await login(email, password)
  }

  const logout = () => {
    localStorage.removeItem('token')
    removeTokenCookie()
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, loading }}>
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

