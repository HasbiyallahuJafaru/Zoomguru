import { useState, useEffect } from 'react';

export function useCVContext() {
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');

  useEffect(() => {
    void window.zoomguru.loadCV().then((stored) => {
      if (stored) setCvText(stored.text);
    });
    void window.zoomguru.loadJD().then((stored) => {
      if (stored) setJdText(stored);
    });
  }, []);

  return { cvText, jdText };
}
