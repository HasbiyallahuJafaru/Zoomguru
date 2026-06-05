import { useState } from 'react';
import DocCopilotSetup from './DocCopilotSetup';
import DocCopilotOverlay from './DocCopilotOverlay';

type Step = 'setup' | 'overlay';

export default function DocCopilotApp() {
  const [step, setStep]   = useState<Step>('setup');
  const [docs, setDocs]   = useState<ParsedDoc[]>([]);

  if (step === 'setup') {
    return (
      <DocCopilotSetup
        docs={docs}
        onDocsChange={setDocs}
        onLaunch={() => setStep('overlay')}
      />
    );
  }

  return (
    <DocCopilotOverlay
      docs={docs}
      onBackToSetup={() => setStep('setup')}
    />
  );
}
