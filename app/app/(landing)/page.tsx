'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  Hero,
  ValueProps,
  Features,
  HowItWorks,
  Quote,
  CTA,
  ForNerds,
  Privacy,
  Footer,
} from '@/components/landing'

export default function LandingPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      router.replace('/journal')
    }
  }, [user, loading, router])

  // Show nothing while checking auth to avoid flash
  if (loading) {
    return null
  }

  // If user is logged in, they'll be redirected
  if (user) {
    return null
  }

  return (
    <div className="landing-page">
      <Hero />
      <ValueProps />
      <Features />
      <HowItWorks />
      <Quote />
      <CTA />
      <ForNerds />
      <Privacy />
      <Footer />
    </div>
  )
}
