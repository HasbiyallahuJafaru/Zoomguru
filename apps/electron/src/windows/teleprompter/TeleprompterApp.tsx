import { useState, useEffect, useRef, useCallback, type CSSProperties } from 'react';

type ElectronStyle = CSSProperties & { WebkitAppRegion?: 'drag' | 'no-drag' };

const FONT  = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif";
const SERIF = "'Palatino Linotype', Palatino, 'Book Antiqua', Georgia, serif";

const MIN_SPEED = 20;
const MAX_SPEED = 200;
const DEFAULT_SPEED = 60;

type Screen = 'setup' | 'scroll';

export default function TeleprompterApp({ onBack }: { onBack?: () => void } = {}) {
  const [screen, setScreen] = useState<Screen>('setup');
  const [text, setText] = useState('');
  const [fontSize, setFontSize] = useState(32);
  const [speed, setSpeed] = useState(DEFAULT_SPEED);
  const [mirror, setMirror] = useState(false);

  function handleStart() {
    if (!text.trim()) return;
    setScreen('scroll');
  }

  if (screen === 'setup') {
    return (
      <Setup
        text={text}
        setText={setText}
        fontSize={fontSize}
        setFontSize={setFontSize}
        speed={speed}
        setSpeed={setSpeed}
        mirror={mirror}
        setMirror={setMirror}
        onStart={handleStart}
        onBack={onBack}
      />
    );
  }

  return (
    <Scroller
      text={text}
      fontSize={fontSize}
      speed={speed}
      mirror={mirror}
      onBack={() => setScreen('setup')}
    />
  );
}

// ─── Setup screen ─────────────────────────────────────────────────────────────

interface SetupProps {
  text: string;
  setText: (v: string) => void;
  fontSize: number;
  setFontSize: (v: number) => void;
  speed: number;
  setSpeed: (v: number) => void;
  mirror: boolean;
  setMirror: (v: boolean) => void;
  onStart: () => void;
  onBack?: () => void;
}

function Setup({ text, setText, fontSize, setFontSize, speed, setSpeed, mirror, setMirror, onStart, onBack }: SetupProps) {
  return (
    <>
      <style>{`
        body { background: #0a0a0a; }
        .zg-tp-start:hover:not(:disabled) { opacity: 0.88; }
        .zg-tp-start:active:not(:disabled) { transform: scale(0.98); }
        .zg-tp-opt:hover { background: rgba(255,255,255,0.07) !important; }
        textarea:focus { outline: none; }
        textarea::placeholder { color: rgba(255,255,255,0.18); }
        input[type=range] { accent-color: rgba(255,255,255,0.70); }
      `}</style>
      <div style={s.setupRoot}>
        <div style={s.setupTitleBar}>
          <span style={s.wordmark}>ZoomGuru</span>
          <span style={s.titleTag}>Interview Assistant</span>
          <button style={s.closeBtn} onClick={() => onBack ? onBack() : void window.zoomguru.quitApp()} aria-label="Back">
          {onBack ? '←' : '×'}
        </button>
        </div>

        <div style={s.setupBody}>
          <textarea
            style={s.textarea}
            placeholder="Paste your script here…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />

          <div style={s.controls}>
            <div style={s.controlRow}>
              <span style={s.controlLabel}>Font size</span>
              <div style={s.controlRight}>
                <input
                  type="range"
                  min={18}
                  max={72}
                  value={fontSize}
                  onChange={(e) => setFontSize(Number(e.target.value))}
                  style={s.slider}
                />
                <span style={s.controlValue}>{fontSize}px</span>
              </div>
            </div>

            <div style={s.controlRow}>
              <span style={s.controlLabel}>Scroll speed</span>
              <div style={s.controlRight}>
                <input
                  type="range"
                  min={MIN_SPEED}
                  max={MAX_SPEED}
                  value={speed}
                  onChange={(e) => setSpeed(Number(e.target.value))}
                  style={s.slider}
                />
                <span style={s.controlValue}>{speed}</span>
              </div>
            </div>

            <div style={s.controlRow}>
              <span style={s.controlLabel}>Mirror text</span>
              <button
                className="zg-tp-opt"
                style={{ ...s.toggleBtn, ...(mirror ? s.toggleBtnOn : s.toggleBtnOff) }}
                onClick={() => setMirror(!mirror)}
              >
                {mirror ? 'On' : 'Off'}
              </button>
            </div>
          </div>

          <button
            className="zg-tp-start"
            style={{ ...s.startBtn, ...(text.trim() ? s.startBtnActive : s.startBtnDisabled) }}
            disabled={!text.trim()}
            onClick={onStart}
          >
            Start
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Scroll screen ────────────────────────────────────────────────────────────

interface ScrollerProps {
  text: string;
  fontSize: number;
  speed: number;
  mirror: boolean;
  onBack: () => void;
}

function Scroller({ text, fontSize, speed, mirror, onBack }: ScrollerProps) {
  const [running, setRunning] = useState(false);
  const [currentSpeed, setCurrentSpeed] = useState(speed);
  const containerRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);

  const scroll = useCallback((ts: number) => {
    const el = containerRef.current;
    if (!el) return;
    if (lastTsRef.current !== null) {
      const dt = ts - lastTsRef.current;
      el.scrollTop += (currentSpeed / 60) * (dt / 16.67);
      if (el.scrollTop >= el.scrollHeight - el.clientHeight) {
        setRunning(false);
        lastTsRef.current = null;
        return;
      }
    }
    lastTsRef.current = ts;
    rafRef.current = requestAnimationFrame(scroll);
  }, [currentSpeed]);

  useEffect(() => {
    if (running) {
      rafRef.current = requestAnimationFrame(scroll);
    } else {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTsRef.current = null;
    }
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [running, scroll]);

  function handleRestart() {
    if (containerRef.current) containerRef.current.scrollTop = 0;
    setRunning(false);
    lastTsRef.current = null;
  }

  return (
    <>
      <style>{`
        body { background: #000; }
        .zg-tp-ctrl:hover { opacity: 0.75 !important; }
        .zg-tp-ctrl:active { transform: scale(0.96); }
        ::-webkit-scrollbar { display: none; }
      `}</style>
      <div style={s.scrollRoot}>
        {/* Toolbar */}
        <div style={s.toolbar}>
          <button className="zg-tp-ctrl" style={s.toolbarBtn} onClick={onBack}>
            Edit
          </button>
          <div style={s.speedRow}>
            <button
              className="zg-tp-ctrl"
              style={s.toolbarBtn}
              onClick={() => setCurrentSpeed((v) => Math.max(MIN_SPEED, v - 10))}
            >
              −
            </button>
            <span style={s.speedLabel}>{currentSpeed}</span>
            <button
              className="zg-tp-ctrl"
              style={s.toolbarBtn}
              onClick={() => setCurrentSpeed((v) => Math.min(MAX_SPEED, v + 10))}
            >
              +
            </button>
          </div>
          <button className="zg-tp-ctrl" style={s.toolbarBtn} onClick={handleRestart}>
            Restart
          </button>
          <button
            className="zg-tp-ctrl"
            style={{ ...s.toolbarBtn, ...s.playBtn }}
            onClick={() => setRunning((r) => !r)}
          >
            {running ? 'Pause' : 'Play'}
          </button>
        </div>

        {/* Text area */}
        <div ref={containerRef} style={s.textContainer}>
          <div
            style={{
              ...s.textContent,
              fontSize: `${fontSize}px`,
              transform: mirror ? 'scaleX(-1)' : undefined,
            }}
          >
            {text}
          </div>
          {/* Bottom padding so last line scrolls fully into center */}
          <div style={{ height: '50vh' }} />
        </div>
      </div>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s: Record<string, ElectronStyle> = {
  // Setup
  setupRoot: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
    userSelect: 'none' as const,
  },
  setupTitleBar: {
    height: '42px',
    minHeight: '42px',
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '0 14px',
    background: 'rgba(255,255,255,0.03)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'drag',
  },
  wordmark: {
    fontSize: '14px',
    fontWeight: 400,
    fontStyle: 'italic',
    fontFamily: SERIF,
    color: 'rgba(255,255,255,0.80)',
    letterSpacing: '0.1px',
  },
  titleTag: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.28)',
    letterSpacing: '0.3px',
    fontFamily: FONT,
  },
  closeBtn: {
    marginLeft: 'auto',
    background: 'transparent',
    border: 'none',
    color: 'rgba(255,255,255,0.25)',
    fontSize: '18px',
    cursor: 'pointer',
    fontFamily: FONT,
    padding: '2px 4px',
    WebkitAppRegion: 'no-drag',
    lineHeight: '1',
  },
  setupBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '20px',
    overflow: 'hidden',
  },
  textarea: {
    flex: 1,
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '8px',
    color: 'rgba(255,255,255,0.80)',
    fontSize: '13px',
    fontFamily: FONT,
    lineHeight: '1.65',
    padding: '14px',
    resize: 'none' as const,
    letterSpacing: '0.1px',
    userSelect: 'text' as const,
    WebkitAppRegion: 'no-drag',
  },
  controls: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
  },
  controlRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
  },
  controlLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.38)',
    fontFamily: FONT,
    letterSpacing: '0.1px',
    minWidth: '80px',
  },
  controlRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    flex: 1,
    justifyContent: 'flex-end',
  },
  slider: {
    width: '120px',
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
  },
  controlValue: {
    fontSize: '10px',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: FONT,
    minWidth: '30px',
    textAlign: 'right' as const,
  },
  toggleBtn: {
    padding: '4px 14px',
    borderRadius: '4px',
    border: 'none',
    fontSize: '10px',
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: FONT,
    letterSpacing: '0.2px',
    transition: 'background 120ms ease',
    WebkitAppRegion: 'no-drag',
  },
  toggleBtnOn: {
    background: 'rgba(52,211,153,0.15)',
    color: 'rgba(52,211,153,0.85)',
  },
  toggleBtnOff: {
    background: 'rgba(255,255,255,0.06)',
    color: 'rgba(255,255,255,0.35)',
  },
  startBtn: {
    width: '100%',
    padding: '11px',
    borderRadius: '6px',
    fontSize: '13px',
    fontWeight: 600,
    fontFamily: FONT,
    letterSpacing: '-0.1px',
    border: 'none',
    cursor: 'pointer',
    transition: 'opacity 120ms ease, transform 100ms ease',
    WebkitAppRegion: 'no-drag',
  },
  startBtnActive: {
    background: '#ffffff',
    color: '#0a0a0a',
  },
  startBtnDisabled: {
    background: 'rgba(255,255,255,0.08)',
    color: 'rgba(255,255,255,0.25)',
    cursor: 'not-allowed',
  },

  // Scroller
  scrollRoot: {
    width: '100vw',
    height: '100vh',
    background: '#000000',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: FONT,
  },
  toolbar: {
    height: '44px',
    minHeight: '44px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '0 14px',
    background: 'rgba(255,255,255,0.04)',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
    WebkitAppRegion: 'drag',
  },
  toolbarBtn: {
    background: 'transparent',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '4px',
    color: 'rgba(255,255,255,0.50)',
    fontSize: '11px',
    fontWeight: 500,
    cursor: 'pointer',
    fontFamily: FONT,
    padding: '4px 12px',
    transition: 'opacity 120ms ease',
    WebkitAppRegion: 'no-drag',
  },
  speedRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  speedLabel: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.40)',
    fontFamily: FONT,
    minWidth: '28px',
    textAlign: 'center' as const,
  },
  playBtn: {
    background: 'rgba(255,255,255,0.90)',
    color: '#0a0a0a',
    border: 'none',
    fontWeight: 700,
  },
  textContainer: {
    flex: 1,
    overflowY: 'auto' as const,
    overflowX: 'hidden' as const,
    padding: '60px 80px 0',
    scrollbarWidth: 'none' as const,
    WebkitAppRegion: 'no-drag',
  },
  textContent: {
    color: '#ffffff',
    lineHeight: '1.55',
    whiteSpace: 'pre-wrap' as const,
    fontFamily: FONT,
    fontWeight: 500,
    letterSpacing: '0.2px',
  },
};
