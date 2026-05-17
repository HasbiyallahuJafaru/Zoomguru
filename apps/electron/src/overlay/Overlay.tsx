import { useState, useEffect, useRef } from 'react';
import { AnswerStream } from './AnswerStream';
import { ModeBar } from './ModeBar';
import { PaywallModal } from './PaywallModal';

const API_URL = import.meta.env.VITE_API_URL;

type Mode = 'behavioral' | 'technical' | 'coding' | 'systemdesign';

export function Overlay() {
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState<Mode>('behavioral');
  const [visible, setVisible] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastImage, setLastImage] = useState('');
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    // Register hotkey triggers from Electron main process
    window.zoomguru.onTrigger('listen', handleListen);
    window.zoomguru.onTrigger('screenshot', handleScreenshot);
    window.zoomguru.onTrigger('regenerate', handleRegenerate);
    window.zoomguru.onTrigger('clear', handleClear);
  }, []);

  async function handleListen() {
    if (isStreaming || isListening) return;

    setIsListening(true);
    try {
      const transcript = await window.zoomguru.startListening();
      setIsListening(false);
      if (transcript && transcript.trim()) {
        setLastTranscript(transcript);
        setLastImage('');
        streamAnswer(transcript, null);
      }
    } catch (e) {
      setIsListening(false);
    }
  }

  async function handleScreenshot() {
    if (isStreaming) return;

    try {
      const imageBase64 = await window.zoomguru.captureScreen();
      setLastImage(imageBase64);
      setLastTranscript('');
      streamScreenshot(imageBase64);
    } catch (e) {
      console.error('Screenshot failed:', e);
    }
  }

  function handleRegenerate() {
    if (isStreaming) return;
    if (lastImage) {
      streamScreenshot(lastImage);
    } else if (lastTranscript) {
      streamAnswer(lastTranscript, null);
    }
  }

  function handleClear() {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setAnswer('');
    setIsStreaming(false);
    setLastTranscript('');
    setLastImage('');
  }

  function streamAnswer(transcript: string, _image: null) {
    setAnswer('');
    setIsStreaming(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('session_id');

    const params = new URLSearchParams({
      transcript,
      sessionId: sessionId || '',
      token: token || '',
      mode,
    });

    const es = new EventSource(`${API_URL}/ai/stream?${params.toString()}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          es.close();
          setIsStreaming(false);
          eventSourceRef.current = null;
        } else if (data.error === 'paywall') {
          es.close();
          setIsStreaming(false);
          eventSourceRef.current = null;
          setShowPaywall(true);
        } else if (data.chunk) {
          setAnswer(prev => prev + data.chunk);
        }
      } catch {
        // ignore parse errors
      }
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
      eventSourceRef.current = null;
    };

    eventSourceRef.current = es;
  }

  function streamScreenshot(imageBase64: string) {
    setAnswer('');
    setIsStreaming(true);

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('session_id');

    // Screenshot goes via POST with SSE response
    const params = new URLSearchParams({
      sessionId: sessionId || '',
      token: token || '',
      mode,
      image: imageBase64,
    });

    const es = new EventSource(`${API_URL}/ai/stream/screenshot?${params.toString()}`);

    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.done) {
          es.close();
          setIsStreaming(false);
          eventSourceRef.current = null;
        } else if (data.error === 'paywall') {
          es.close();
          setIsStreaming(false);
          setShowPaywall(true);
        } else if (data.chunk) {
          setAnswer(prev => prev + data.chunk);
        }
      } catch {
        // ignore
      }
    };

    es.onerror = () => {
      es.close();
      setIsStreaming(false);
      eventSourceRef.current = null;
    };

    eventSourceRef.current = es;
  }

  if (!visible) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(10, 10, 15, 0.88)',
        backdropFilter: 'blur(12px)',
        borderRadius: '16px',
        border: '1px solid rgba(255,255,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          WebkitAppRegion: 'drag' as any,
          flexShrink: 0,
        }}>
          <span style={{ color: '#fff', fontSize: 13, fontWeight: 700, letterSpacing: 0.3 }}>
            ZoomGuru
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isListening && (
              <span style={{
                color: '#22c55e',
                fontSize: 11,
                animation: 'pulse 1.5s infinite',
              }}>
                ● Listening...
              </span>
            )}
            {isStreaming && (
              <span style={{ color: '#3b82f6', fontSize: 11 }}>● Thinking...</span>
            )}
            {!isListening && !isStreaming && (
              <span style={{ color: 'rgba(255,255,255,0.2)', fontSize: 10 }}>Ready</span>
            )}

            {/* Upgrade button */}
            <button
              onClick={() => setShowPaywall(true)}
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid rgba(234,179,8,0.3)',
                background: 'rgba(234,179,8,0.1)',
                color: '#eab308',
                fontSize: 10,
                cursor: 'pointer',
                WebkitAppRegion: 'no-drag' as any,
              }}
            >
              Pro
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <ModeBar mode={mode} onModeChange={setMode} />

        {/* Streaming Answer */}
        <AnswerStream answer={answer} isStreaming={isStreaming} />

        {/* Footer */}
        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          gap: 10,
          fontSize: 10,
          color: 'rgba(255,255,255,0.25)',
          flexShrink: 0,
        }}>
          <span>⌘⇧A Listen</span>
          <span>⌘⇧S Screen</span>
          <span>⌘⇧H Hide</span>
          <span>⌘⇧R Retry</span>
          <span>⌘⇧C Clear</span>
        </div>
      </div>

      {showPaywall && (
        <PaywallModal onClose={() => setShowPaywall(false)} />
      )}
    </>
  );
}
