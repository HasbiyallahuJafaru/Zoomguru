import Hero from '@/components/Hero';
import HowItWorks from '@/components/HowItWorks';
import Features from '@/components/Features';
import Testimonials from '@/components/Testimonials';
import Pricing from '@/components/Pricing';
import Download from '@/components/Download';
import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';

export default function Home() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Features />
      <Testimonials />
      <Pricing />
      <Download />
      <FAQ />
      <Footer />
    </>
  );
}
