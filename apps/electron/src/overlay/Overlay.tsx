import { useState, useEffect, useRef } from 'react';
import { AnswerStream } from './AnswerStream';
import { ModeBar } from './ModeBar';
import { PaywallModal } from './PaywallModal';

const API_URL: string =
  import.meta.env.VITE_API_URL ||
  'https://zoomguru.onrender.com';

type Mode = 'behavioral' | 'technical' | 'coding' | 'systemdesign';
type ProtectionStatus = 'checking' | 'protected' | 'exposed';

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refresh_token');
  if (!refreshToken) return null;
  try {
    const deviceId = await window.zoomguru.getDeviceId();
    const res = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Device-ID': deviceId },
      body: JSON.stringify({ refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    localStorage.setItem('access_token', data.accessToken);
    if (data.refreshToken) localStorage.setItem('refresh_token', data.refreshToken);
    return data.accessToken;
  } catch {
    return null;
  }
}

async function apiFetch(url: string, options: RequestInit): Promise<Response> {
  let res = await fetch(url, options);
  if (res.status === 401) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      const headers = new Headers(options.headers);
      headers.set('Authorization', `Bearer ${newToken}`);
      res = await fetch(url, { ...options, headers });
    }
    if (res.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('session_id');
      window.location.reload();
    }
  }
  return res;
}

export function Overlay() {
  const [answer, setAnswer] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [mode, setMode] = useState<Mode>('behavioral');
  const [visible, setVisible] = useState(true);
  const [showPaywall, setShowPaywall] = useState(false);
  const [lastTranscript, setLastTranscript] = useState('');
  const [lastImage, setLastImage] = useState('');
  const [copied, setCopied] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [protection, setProtection] = useState<ProtectionStatus>('checking');

  const sessionStartRef = useRef<number>(Date.now());
  const sessionMessagesRef = useRef<Array<{ role: string; content: string }>>([]);
  const sessionQuestionsRef = useRef<number>(0);
  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('zg_opacity');
    return saved ? parseFloat(saved) : 0.20;
  });

  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleRegenerateRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});

  useEffect(() => {
    window.zoomguru.onTrigger('listen', () => handleListenRef.current());
    window.zoomguru.onTrigger('screenshot', () => handleScreenshotRef.current());
    window.zoomguru.onTrigger('regenerate', () => handleRegenerateRef.current());
    window.zoomguru.onTrigger('clear', () => handleClearRef.current());

    window.zoomguru.onEvent('protection:status', (data: {
      protected: boolean;
      reason: string;
      platform: string;
    }) => {
      setProtection(data.protected ? 'protected' : 'exposed');
    });

    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  async function handleListen() {
    if (isStreaming || isListening) return;

    const stream = await navigator.mediaDevices
      .getUserMedia({ audio: true })
      .catch(() => null);

    if (!stream) {
      setAnswer(
        '⚠ Microphone access denied.\n\n' +
        'Fix: System Settings → Privacy → Microphone → Enable ZoomGuru'
      );
      return;
    }
    stream.getTracks().forEach(t => t.stop());

    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setAnswer('⚠ Speech recognition not available. Type your question instead.');
      return;
    }

    setIsListening(true);
    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setIsListening(false);
      if (transcript.trim()) {
        setLastTranscript(transcript);
        setLastImage('');
        streamAnswer(transcript, null);
      }
    };

    recognition.onerror = () => {
      setIsListening(false);
      setAnswer('⚠ Could not capture speech. Try again or type your question.');
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
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

  function copyAnswer() {
    if (!answer) return;
    const clean = answer
      .replace(/[#*`_~]/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
    navigator.clipboard.writeText(clean);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleOpacityChange(val: number) {
    setOpacity(val);
    localStorage.setItem('zg_opacity', val.toString());
  }

  function handleClear() {
    setAnswer('');
    setIsStreaming(false);
    setLastTranscript('');
    setLastImage('');
  }

  handleListenRef.current = handleListen;
  handleScreenshotRef.current = handleScreenshot;
  handleRegenerateRef.current = handleRegenerate;
  handleClearRef.current = handleClear;

  async function streamAnswer(transcript: string, _image: null) {
    setAnswer('');
    setIsStreaming(true);

    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('session_id');

    try {
      const response = await apiFetch(`${API_URL}/ai/stream`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'X-Device-ID': await window.zoomguru.getDeviceId(),
        },
        body: JSON.stringify({ transcript, sessionId: sessionId || '', mode }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 403 && (err as any)?.message?.includes('limit')) {
          setShowPaywall(true);
        } else {
          setAnswer('⚠ Request failed. Please try again.');
        }
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setAnswer('⚠ No response body received. Please try again.');
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const data = JSON.parse(raw);
            if (data.done) {
              if (data.fullAnswer) {
                sessionMessagesRef.current.push({ role: 'user', content: transcript });
                sessionMessagesRef.current.push({ role: 'assistant', content: data.fullAnswer });
                sessionQuestionsRef.current += 1;
              }
              setIsStreaming(false);
              return;
            }
            if (data.error) {
              const msg: string = data.error;
              if (msg.includes('limit') || msg.includes('Upgrade') || msg.includes('Pro')) {
                setShowPaywall(true);
              } else {
                setAnswer('⚠ ' + msg);
              }
              setIsStreaming(false);
              return;
            }
            if (data.chunk) {
              setAnswer(prev => prev + data.chunk);
            }
          } catch {
            // ignore malformed chunk
          }
        }
      }
    } catch (err) {
      console.error('Stream error:', err);
      setAnswer('⚠ Connection lost. Check your internet and try again.');
    } finally {
      setIsStreaming(false);
    }
  }

  async function streamScreenshot(imageBase64: string) {
    setAnswer('');
    setIsStreaming(true);

    const token = localStorage.getItem('access_token');
    const sessionId = localStorage.getItem('session_id');

    try {
      const response = await apiFetch(`${API_URL}/ai/screenshot`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token || ''}`,
          'X-Device-ID': await window.zoomguru.getDeviceId(),
        },
        body: JSON.stringify({ image: imageBase64, sessionId: sessionId || '', mode }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 403 && (err as any)?.message?.includes('limit')) {
          setShowPaywall(true);
        } else {
          setAnswer('⚠ Screenshot request failed. Please try again.');
        }
        setIsStreaming(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setAnswer('⚠ No response body received. Please try again.');
        setIsStreaming(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const raw = line.slice(6).trim();
          if (!raw || raw === '[DONE]') continue;

          try {
            const data = JSON.parse(raw);
            if (data.done) {
              setIsStreaming(false);
              return;
            }
            if (data.error) {
              const msg: string = data.error;
              if (msg.includes('limit') || msg.includes('Upgrade')) {
                setShowPaywall(true);
              } else {
                setAnswer('⚠ ' + msg);
              }
              setIsStreaming(false);
              return;
            }
            if (data.chunk) {
              setAnswer(prev => prev + data.chunk);
            }
          } catch {
            // ignore
          }
        }
      }
    } catch (err) {
      console.error('Screenshot stream error:', err);
      setAnswer('⚠ Connection lost. Check your internet and try again.');
    } finally {
      setIsStreaming(false);
    }
  }

  if (!visible) return null;

  return (
    <>
      <div style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        background: '#fff',
        borderRadius: '20px',
        border: '1.5px solid #e5e5e5',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
        boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
        opacity,
      }}>
        {/* Header */}
        <div style={{
          padding: '12px 16px',
          background: '#f5f5f3',
          borderBottom: '1px solid #e5e5e5',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          WebkitAppRegion: 'drag',
          flexShrink: 0,
        } as React.CSSProperties & { WebkitAppRegion: string }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 22, height: 22, borderRadius: 6, background: '#111', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>Z</span>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#333', letterSpacing: '-0.2px' }}>ZoomGuru</span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isListening && <span style={{ color: '#16a34a', fontSize: 11, fontWeight: 600 }}>● Listening...</span>}
            {isStreaming && <span style={{ color: '#2563eb', fontSize: 11, fontWeight: 600 }}>● Thinking...</span>}
            {!isListening && !isStreaming && <span style={{ color: '#bbb', fontSize: 10 }}>Ready</span>}
            {!isOnline && <span style={{ color: '#dc2626', fontSize: 10, fontWeight: 600 }}>⚠ Offline</span>}

            {protection === 'checking' && (
              <span style={{ fontSize: 9, color: '#bbb', letterSpacing: '0.05em' }}>checking...</span>
            )}
            {protection === 'protected' && (
              <span style={{ fontSize: 9, color: '#16a34a', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }} />
                Hidden
              </span>
            )}
            {protection === 'exposed' && (
              <span title="Overlay may be visible to screen share." style={{ fontSize: 9, color: '#dc2626', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 3, cursor: 'pointer' }}>
                <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#dc2626', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
                ⚠ Visible
              </span>
            )}

            <button
              onClick={async () => {
                const sessionId = localStorage.getItem('session_id');
                const token = localStorage.getItem('access_token');
                if (sessionId && token) {
                  try {
                    const deviceId = await window.zoomguru.getDeviceId();
                    await apiFetch(`${API_URL}/session/end`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                        'X-Device-ID': deviceId,
                      },
                      body: JSON.stringify({
                        sessionId,
                        messages: sessionMessagesRef.current,
                        durationSeconds: Math.round((Date.now() - sessionStartRef.current) / 1000),
                        totalQuestions: sessionQuestionsRef.current,
                      }),
                    });
                  } catch {
                    // Don't block new session if end fails
                  }
                }
                localStorage.removeItem('session_id');
                window.location.reload();
              }}
              title="Start a new interview session"
              style={{
                padding: '3px 8px', borderRadius: 5,
                border: '1px solid #e5e5e5',
                background: 'transparent', color: '#666',
                fontSize: 10, cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties & { WebkitAppRegion: string }}
            >New</button>

            <button
              onClick={() => window.zoomguru.hideWindow()}
              title="Hide to tray (Ctrl+Shift+H)"
              style={{
                padding: '3px 8px', borderRadius: 5,
                border: '1px solid #e5e5e5',
                background: 'transparent', color: '#999',
                fontSize: 12, lineHeight: 1, cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties & { WebkitAppRegion: string }}
            >✕</button>

            <button
              onClick={() => setShowPaywall(true)}
              style={{
                padding: '3px 8px', borderRadius: 5,
                border: '1.5px solid #111',
                background: '#111', color: '#fff',
                fontSize: 10, fontWeight: 700, cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties & { WebkitAppRegion: string }}
            >Pro</button>
          </div>
        </div>

        <ModeBar mode={mode} onModeChange={setMode} />
        <AnswerStream answer={answer} isStreaming={isStreaming} />

        {answer && !isStreaming && (
          <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
            <button onClick={copyAnswer} style={{
              background: 'transparent',
              border: '1px solid #e5e5e5',
              borderRadius: 6,
              color: copied ? '#16a34a' : '#666',
              fontSize: 11, fontWeight: copied ? 600 : 400,
              padding: '4px 10px', cursor: 'pointer',
            }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}

        <div style={{
          padding: '8px 16px',
          borderTop: '1px solid #e5e5e5',
          background: '#fafaf8',
          display: 'flex', gap: 10,
          fontSize: 10, color: '#bbb', flexShrink: 0,
        }}>
          {(() => {
            const mod = navigator.platform.includes('Mac') ? '⌘⇧' : 'Ctrl+';
            return (<>
              <span>{mod}A Listen</span>
              <span>{mod}S Screen</span>
              <span>{mod}H Hide</span>
              <span>{mod}R Retry</span>
              <span>{mod}C Clear</span>
            </>);
          })()}
          <input
            type="range"
            min={0.1} max={0.95} step={0.05}
            value={opacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            style={{ width: 60, cursor: 'pointer', accentColor: '#111', marginLeft: 'auto' }}
            title="Overlay opacity"
          />
        </div>
      </div>

      {showPaywall && <PaywallModal onClose={() => setShowPaywall(false)} />}
    </>
  );
}
