import { Hero } from '@/components/landing/Hero';
import { LogoTicker } from '@/components/landing/LogoTicker';
import { Features } from '@/components/landing/Features';
import { ExamplesCarousel } from '@/components/landing/ExamplesCarousel';
import { Pricing } from '@/components/landing/Pricing';
import { UsageGuideCarousel } from '@/components/landing/UsageGuideCarousel';
import { FAQ } from '@/components/landing/FAQ';

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white overflow-hidden">
      <Hero />
      <LogoTicker />
      <Features />
      <ExamplesCarousel />
      <Pricing />
      <UsageGuideCarousel />
      <FAQ />
    </main>
  );
}
