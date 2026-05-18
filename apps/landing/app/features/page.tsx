import Features from '@/components/Features';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'Features — ZoomGuru',
  description: 'Every feature built for real interviews. Invisible overlay, CV-personalized answers, screenshot vision, local speech transcription, and deep reasoning AI.',
};

export default function FeaturesPage() {
  return (
    <>
      <div className="pt-16">
        <Features />
      </div>
      <Footer />
    </>
  );
}
