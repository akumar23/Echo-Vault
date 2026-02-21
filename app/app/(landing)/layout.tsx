import { LandingHeader } from '@/components/landing/LandingHeader'
import { MotionProvider } from '@/components/motion'
import { AmbientBackground } from '@/components/AmbientBackground'

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <MotionProvider>
      <AmbientBackground />
      <LandingHeader />
      <main>{children}</main>
    </MotionProvider>
  )
}
