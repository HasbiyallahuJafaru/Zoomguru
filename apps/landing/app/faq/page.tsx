import FAQ from '@/components/FAQ';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'FAQ — ZoomGuru',
  description: 'Common questions about ZoomGuru — screen share invisibility, CV privacy, device licensing, offline mode, and answer speed.',
};

export default function FAQPage() {
  return (
    <>
      <div className="pt-16">
        <FAQ />
      </div>
      <Footer />
    </>
  );
}
