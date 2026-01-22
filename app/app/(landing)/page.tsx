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
