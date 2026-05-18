import HowItWorks from '@/components/HowItWorks';
import Footer from '@/components/Footer';

export const metadata = {
  title: 'How It Works — ZoomGuru',
  description: 'Up and running in under 2 minutes. Upload your CV, open your video call, trigger on any question, and deliver the answer.',
};

export default function HowItWorksPage() {
  return (
    <>
      <div className="pt-16">
        <HowItWorks />
      </div>
      <Footer />
    </>
  );
}
