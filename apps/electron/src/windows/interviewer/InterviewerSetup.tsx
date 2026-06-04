import { useState } from 'react';
import type { SessionConfig, Difficulty } from './InterviewerApp';

interface Props {
  onStart: (config: SessionConfig) => void;
  onClose: () => void;
}

const DIFFICULTIES: { value: Difficulty; label: string; desc: string }[] = [
  { value: 'easy', label: 'Easy', desc: 'Foundation questions — great for warm-up or junior roles' },
  { value: 'medium', label: 'Medium', desc: 'Standard interview depth for most positions' },
  { value: 'hard', label: 'Hard', desc: 'Senior / staff-level technical and situational depth' },
  { value: 'dynamic', label: 'Dynamic', desc: 'AI adjusts difficulty in real time based on your answers' },
];

const InterviewerSetup = ({ onStart, onClose }: Props) => {
  const [cvText, setCvText] = useState('');
  const [jdText, setJdText] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('medium');
  const [loadingCv, setLoadingCv] = useState(false);
  const [cvFilename, setCvFilename] = useState('');

  async function handleCvUpload(): Promise<void> {
    setLoadingCv(true);
    const result = await window.zoomguru.parseCV();
    setLoadingCv(false);
    if (!result) return;
    if ('error' in result) return;
    setCvText(result.text);
    setCvFilename(result.filename);
  }

  function handleStart(): void {
    if (!cvText && !jdText) return;
    onStart({ cvText, jdText, difficulty });
  }

  const canStart = cvText.trim().length > 0 || jdText.trim().length > 0;

  return (
    <div style={styles.root}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>AI Interviewer Setup</span>
        <button style={styles.closeBtn} onClick={onClose}>✕</button>
      </div>

      <div style={styles.body}>
        <section style={styles.section}>
          <label style={styles.label}>CV / Resume</label>
          <div style={styles.cvRow}>
            <button
              style={loadingCv ? styles.btnDisabled : styles.btnOutline}
              onClick={() => void handleCvUpload()}
              disabled={loadingCv}
            >
              {loadingCv ? 'Parsing…' : cvFilename ? `✓ ${cvFilename}` : 'Upload PDF'}
            </button>
            {cvFilename && (
              <button
                style={styles.clearBtn}
                onClick={() => { setCvText(''); setCvFilename(''); }}
              >
                Remove
              </button>
            )}
          </div>
        </section>

        <section style={styles.section}>
          <label style={styles.label}>Job Description (optional)</label>
          <textarea
            style={styles.textarea}
            placeholder="Paste the job description here…"
            value={jdText}
            onChange={(e) => setJdText(e.target.value)}
            maxLength={6000}
          />
          <div style={styles.charCount}>{jdText.length} / 6000</div>
        </section>

        <section style={styles.section}>
          <label style={styles.label}>Difficulty</label>
          <div style={styles.difficultyGrid}>
            {DIFFICULTIES.map((d) => (
              <button
                key={d.value}
                style={difficulty === d.value ? styles.diffSelected : styles.diffOption}
                onClick={() => setDifficulty(d.value)}
              >
                <span style={styles.diffLabel}>{d.label}</span>
                <span style={styles.diffDesc}>{d.desc}</span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <div style={styles.footer}>
        {!canStart && (
          <span style={styles.hint}>Upload your CV or paste a job description to continue</span>
        )}
        <button
          style={canStart ? styles.btnStart : styles.btnDisabled}
          onClick={handleStart}
          disabled={!canStart}
        >
          Start Session →
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#fff',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 28px',
    borderBottom: '1px solid #1e1e1e',
    WebkitAppRegion: 'drag',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: 700,
  },
  closeBtn: {
    background: 'none',
    border: 'none',
    color: '#666',
    fontSize: 18,
    cursor: 'pointer',
    WebkitAppRegion: 'no-drag',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px 28px',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: '#aaa',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cvRow: {
    display: 'flex',
    gap: 10,
    alignItems: 'center',
  },
  btnOutline: {
    padding: '10px 20px',
    borderRadius: 8,
    border: '1px solid #333',
    background: 'transparent',
    color: '#fff',
    fontSize: 14,
    cursor: 'pointer',
  },
  clearBtn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #333',
    background: 'transparent',
    color: '#888',
    fontSize: 13,
    cursor: 'pointer',
  },
  textarea: {
    background: '#141414',
    border: '1px solid #2a2a2a',
    borderRadius: 10,
    color: '#fff',
    fontSize: 14,
    padding: '14px 16px',
    resize: 'vertical',
    minHeight: 140,
    outline: 'none',
    fontFamily: 'inherit',
    lineHeight: 1.6,
  },
  charCount: {
    fontSize: 12,
    color: '#555',
    textAlign: 'right',
  },
  difficultyGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 10,
  },
  diffOption: {
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid #222',
    background: '#111',
    color: '#aaa',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  diffSelected: {
    padding: '14px 16px',
    borderRadius: 10,
    border: '1px solid #fff',
    background: '#1a1a1a',
    color: '#fff',
    textAlign: 'left',
    cursor: 'pointer',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
  },
  diffLabel: {
    fontSize: 14,
    fontWeight: 600,
  },
  diffDesc: {
    fontSize: 12,
    color: '#888',
    lineHeight: 1.4,
  },
  footer: {
    padding: '18px 28px',
    borderTop: '1px solid #1e1e1e',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 16,
  },
  hint: {
    fontSize: 13,
    color: '#555',
  },
  btnStart: {
    padding: '12px 28px',
    borderRadius: 10,
    border: 'none',
    background: '#fff',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 15,
    cursor: 'pointer',
  },
  btnDisabled: {
    padding: '12px 28px',
    borderRadius: 10,
    border: 'none',
    background: '#222',
    color: '#555',
    fontWeight: 600,
    fontSize: 15,
    cursor: 'not-allowed',
  },
};

export default InterviewerSetup;
