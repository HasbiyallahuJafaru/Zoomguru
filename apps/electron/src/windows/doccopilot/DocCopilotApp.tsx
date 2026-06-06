import { useState } from 'react';
import DocCopilotSetup from './DocCopilotSetup';
import DocCopilotOverlay from './DocCopilotOverlay';

type Step = 'setup' | 'overlay';

function isParsedDoc(x: unknown): x is ParsedDoc {
  return typeof x === 'object' && x !== null && 'docId' in x && 'fileName' in x && 'fileType' in x;
}

export default function DocCopilotApp() {
  const [step, setStep]       = useState<Step>('setup');
  const [docs, setDocs]       = useState<ParsedDoc[]>([]);
  const [parsing, setParsing] = useState(false);

  async function handleAddDoc() {
    if (docs.length >= 3 || parsing) return;
    setParsing(true);
    try {
      const raw = await window.zoomguru.docCopilotParseFiles();
      const safe = raw.filter(isParsedDoc);
      setDocs((prev) => {
        const merged = [...prev];
        for (const d of safe) {
          if (merged.length >= 3) break;
          if (!merged.find((x) => x.docId === d.docId)) merged.push(d);
        }
        return merged;
      });
    } finally {
      setParsing(false);
    }
  }

  function handleRemoveDoc(docId: string) {
    setDocs((prev) => prev.filter((d) => d.docId !== docId));
  }

  if (step === 'setup') {
    return (
      <DocCopilotSetup
        docs={docs}
        onDocsChange={setDocs}
        onLaunch={() => setStep('overlay')}
        isParsing={parsing}
        onAddDoc={() => { void handleAddDoc(); }}
      />
    );
  }

  return (
    <DocCopilotOverlay
      docs={docs}
      onBackToSetup={() => setStep('setup')}
      isParsing={parsing}
      onAddDoc={() => { void handleAddDoc(); }}
      onRemoveDoc={handleRemoveDoc}
    />
  );
}
