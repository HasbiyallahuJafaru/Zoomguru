import { useState, useEffect, useRef } from 'react';
import { AnswerStream } from './AnswerStream';
import { ModeBar } from './ModeBar';
import { PaywallModal } from './PaywallModal';

const API_URL: string =
  import.meta.env.VITE_API_URL ||
  'http://localhost:3000';
if (!import.meta.env.VITE_API_URL) {
  console.warn(
    '[ZoomGuru] VITE_API_URL not set in .env — ' +
    'falling back to http://localhost:3000'
  );
}

type Mode = 'behavioral' | 'technical' | 'coding' | 'systemdesign';
type ProtectionStatus = 'checking' | 'protected' | 'exposed';

// Refresh the access token using the stored refresh token. Returns the new token or null on failure.
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

// Fetch wrapper that auto-refreshes on 401 and reloads to login on second failure.
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

  // Session tracking for /session/end
  const sessionStartRef = useRef<number>(Date.now());
  const sessionMessagesRef = useRef<Array<{ role: string; content: string }>>([]);
  const sessionQuestionsRef = useRef<number>(0);
  const [opacity, setOpacity] = useState<number>(() => {
    const saved = localStorage.getItem('zg_opacity');
    return saved ? parseFloat(saved) : 0.20;
  });

  // Refs that always point to the latest handler — prevents stale closures in IPC registrations
  const handleListenRef = useRef<() => void>(() => {});
  const handleScreenshotRef = useRef<() => void>(() => {});
  const handleRegenerateRef = useRef<() => void>(() => {});
  const handleClearRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Register hotkey triggers from Electron main process (once, via stable ref dispatchers)
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

    // Check mic permission first
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

    // Use Web Speech API (available in Electron's Chromium)
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

  // Keep refs in sync with latest handlers on every render
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
        body: JSON.stringify({
          transcript,
          sessionId: sessionId || '',
          mode,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 403 &&
            (err as any)?.message?.includes('limit')) {
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
        body: JSON.stringify({
          image: imageBase64,
          sessionId: sessionId || '',
          mode,
        }),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        if (response.status === 403 &&
            (err as any)?.message?.includes('limit')) {
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
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: `rgba(80, 50, 20, ${opacity})`,
        backdropFilter: opacity > 0.5 ? 'blur(12px)' : 'blur(4px)',
        WebkitBackdropFilter: opacity > 0.5 ? 'blur(12px)' : 'blur(4px)',
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
          WebkitAppRegion: 'drag',
          flexShrink: 0,
        } as React.CSSProperties & { WebkitAppRegion: string }}>
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
            {!isOnline && (
              <span style={{ color: '#ef4444', fontSize: 10 }}>⚠ No connection</span>
            )}

            {protection === 'checking' && (
              <span style={{
                fontFamily: 'var(--mono, monospace)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.25)',
                letterSpacing: '0.05em',
              }}>
                checking...
              </span>
            )}

            {protection === 'protected' && (
              <span style={{
                fontFamily: 'var(--mono, monospace)',
                fontSize: 9,
                color: '#10b981',
                letterSpacing: '0.05em',
                display: 'flex',
                alignItems: 'center',
                gap: 3,
              }}>
                <span style={{
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: '#10b981',
                  display: 'inline-block',
                  boxShadow: '0 0 4px #10b981',
                }} />
                Hidden
              </span>
            )}

            {protection === 'exposed' && (
              <span
                style={{
                  fontFamily: 'var(--mono, monospace)',
                  fontSize: 9,
                  color: '#ef4444',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
                title="Overlay may be visible to screen share. Restart the app and try again."
              >
                <span style={{
                  width: 5, height: 5,
                  borderRadius: '50%',
                  background: '#ef4444',
                  display: 'inline-block',
                  animation: 'pulse 1.5s infinite',
                }} />
                ⚠ Visible
              </span>
            )}

            {/* New session */}
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
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.12)',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 10,
                cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties & { WebkitAppRegion: string }}
            >
              New
            </button>

            {/* Hide to tray */}
            <button
              onClick={() => window.zoomguru.hideWindow()}
              title="Hide to tray (Ctrl+Shift+H)"
              style={{
                padding: '3px 8px',
                borderRadius: 5,
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'rgba(255,255,255,0.04)',
                color: 'rgba(255,255,255,0.4)',
                fontSize: 12,
                lineHeight: 1,
                cursor: 'pointer',
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties & { WebkitAppRegion: string }}
            >
              ✕
            </button>

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
                WebkitAppRegion: 'no-drag',
              } as React.CSSProperties & { WebkitAppRegion: string }}
            >
              Pro
            </button>
          </div>
        </div>

        {/* Mode Switcher */}
        <ModeBar mode={mode} onModeChange={setMode} />

        {/* Streaming Answer */}
        <AnswerStream answer={answer} isStreaming={isStreaming} />

        {/* Copy button — only shown when there's an answer */}
        {answer && !isStreaming && (
          <div style={{ padding: '0 16px 8px', flexShrink: 0 }}>
            <button onClick={copyAnswer} style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 6,
              color: copied ? '#22c55e' : 'rgba(255,255,255,0.6)',
              fontSize: 11,
              padding: '4px 10px',
              cursor: 'pointer',
              marginTop: 8,
            }}>
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}

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
            min={0.1}
            max={0.95}
            step={0.05}
            value={opacity}
            onChange={(e) => handleOpacityChange(parseFloat(e.target.value))}
            style={{ width: 60, cursor: 'pointer', accentColor: '#3b82f6', marginLeft: 'auto' }}
            title="Overlay opacity"
          />
        </div>
      </div>

      {showPaywall && (
        <PaywallModal onClose={() => setShowPaywall(false)} />
      )}
    </>
  );
}
