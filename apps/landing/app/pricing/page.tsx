import Pricing from '@/components/Pricing';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Pricing — ZoomGuru',
  description: 'Start free with 3 sessions. Upgrade to Monthly or Lifetime Pro for unlimited interviews, screenshot mode, and wake word detection.',
};

export default function PricingPage() {
  return (
    <>
      <div className="pt-16">
        <Pricing />
      </div>
      <Footer />
    </>
  );
}
