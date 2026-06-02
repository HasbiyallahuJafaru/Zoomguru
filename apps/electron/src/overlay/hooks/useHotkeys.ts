import { useEffect } from 'react';

export function useHotkeys(
  onListen: () => void,
  onScreenshot: () => void,
  onClear: () => void,
  onAuto: () => void,
) {
  useEffect(() => {
    window.zoomguru.onTrigger('listen', () => { void onListen(); });
    window.zoomguru.onTrigger('screenshot', () => { void onScreenshot(); });
    window.zoomguru.onTrigger('clear', () => onClear());
    window.zoomguru.onTrigger('auto', () => { void onAuto(); });

    return () => {
      window.zoomguru.offTrigger('listen');
      window.zoomguru.offTrigger('screenshot');
      window.zoomguru.offTrigger('clear');
      window.zoomguru.offTrigger('auto');
    };
  }, []);
}
