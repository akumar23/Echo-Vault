import { LandingHeader } from '@/components/landing/LandingHeader'

export default function LandingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <>
      <LandingHeader />
      <main>{children}</main>
    </>
  )
}
