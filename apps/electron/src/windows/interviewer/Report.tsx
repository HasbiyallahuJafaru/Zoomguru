import type { ScorerReport } from './InterviewerApp';

interface Props {
  report: ScorerReport;
  questionCount: number;
  onClose: () => void;
}

function ScoreRing({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
      <div
        style={{
          width: 96,
          height: 96,
          borderRadius: '50%',
          border: `6px solid ${color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 28,
          fontWeight: 800,
          color,
        }}
      >
        {score}
      </div>
      <span style={{ fontSize: 13, color: '#888' }}>Overall</span>
    </div>
  );
}

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
      <div style={{ flex: 1, height: 6, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ width: `${score}%`, height: '100%', background: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 13, color, fontWeight: 700, minWidth: 30, textAlign: 'right' }}>
        {score}
      </span>
    </div>
  );
}

const Report = ({ report, questionCount, onClose }: Props) => {
  function handlePrint(): void {
    void window.zoomguru.printReport();
  }

  return (
    <div style={styles.root}>
      <div style={styles.topBar}>
        <span style={styles.title}>Session Report</span>
        <div style={{ display: 'flex', gap: 12, WebkitAppRegion: 'no-drag' }}>
          <button style={styles.btnOutline} onClick={handlePrint}>
            Export PDF
          </button>
          <button style={styles.btnPrimary} onClick={onClose}>
            Done
          </button>
        </div>
      </div>

      <div style={styles.body} id="report-printable">
        <div style={styles.hero}>
          <ScoreRing score={report.overallScore} />
          <div style={{ marginLeft: 28 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>
              {report.overallScore >= 80
                ? 'Strong performance'
                : report.overallScore >= 60
                ? 'Solid foundation'
                : 'Room for improvement'}
            </div>
            <div style={{ fontSize: 14, color: '#888', marginTop: 4 }}>
              {questionCount} question{questionCount !== 1 ? 's' : ''} answered
            </div>
          </div>
        </div>

        <div style={styles.columns}>
          <Section title="Strengths">
            {report.strengths.map((s, i) => (
              <BulletItem key={i} text={s} color="#22c55e" />
            ))}
          </Section>
          <Section title="Areas to Improve">
            {report.improvements.map((s, i) => (
              <BulletItem key={i} text={s} color="#f59e0b" />
            ))}
          </Section>
        </div>

        {report.nextFocus && (
          <div style={styles.focusBox}>
            <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#555', textTransform: 'uppercase' }}>
              Next session focus
            </span>
            <p style={{ margin: '8px 0 0', fontSize: 14, color: '#ccc', lineHeight: 1.6 }}>
              {report.nextFocus}
            </p>
          </div>
        )}

        <div style={styles.answersSection}>
          <div style={styles.sectionTitle}>Per-Question Breakdown</div>
          {report.answers.map((a) => (
            <div key={a.questionNumber} style={styles.answerRow}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 8 }}>
                <span style={styles.qNumber}>Q{a.questionNumber}</span>
                <span style={styles.qText}>{a.question}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <ScoreBar score={a.score} />
              </div>
              <p style={styles.assessment}>{a.assessment}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={styles.sectionBox}>
      <div style={styles.sectionTitle}>{title}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {children}
      </div>
    </div>
  );
}

function BulletItem({ text, color }: { text: string; color: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
      <span style={{ color, fontSize: 18, lineHeight: 1, marginTop: 1 }}>•</span>
      <span style={{ fontSize: 14, color: '#ccc', lineHeight: 1.5 }}>{text}</span>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    width: '100vw',
    height: '100vh',
    background: '#0a0a0a',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#fff',
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 28px',
    borderBottom: '1px solid #1a1a1a',
    WebkitAppRegion: 'drag',
    flexShrink: 0,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: '#fff',
  },
  body: {
    flex: 1,
    overflowY: 'auto',
    padding: '28px 36px 48px',
    display: 'flex',
    flexDirection: 'column',
    gap: 24,
  },
  hero: {
    display: 'flex',
    alignItems: 'center',
    background: '#111',
    borderRadius: 12,
    padding: '24px 28px',
    border: '1px solid #1e1e1e',
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 16,
  },
  sectionBox: {
    background: '#111',
    borderRadius: 12,
    padding: '20px 22px',
    border: '1px solid #1e1e1e',
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.08em',
    color: '#555',
    textTransform: 'uppercase',
  },
  focusBox: {
    background: '#111',
    borderRadius: 12,
    padding: '18px 22px',
    border: '1px solid #1e1e1e',
  },
  answersSection: {
    background: '#111',
    borderRadius: 12,
    padding: '20px 22px',
    border: '1px solid #1e1e1e',
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
  },
  answerRow: {
    borderTop: '1px solid #1a1a1a',
    paddingTop: 16,
    paddingBottom: 16,
  },
  qNumber: {
    fontSize: 12,
    fontWeight: 700,
    color: '#555',
    minWidth: 24,
    marginTop: 2,
  },
  qText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 1.5,
  },
  assessment: {
    margin: '8px 0 0 36px',
    fontSize: 13,
    color: '#888',
    lineHeight: 1.5,
  },
  btnPrimary: {
    padding: '8px 20px',
    borderRadius: 8,
    border: 'none',
    background: '#fff',
    color: '#0a0a0a',
    fontWeight: 700,
    fontSize: 13,
    cursor: 'pointer',
  },
  btnOutline: {
    padding: '8px 20px',
    borderRadius: 8,
    border: '1px solid #333',
    background: 'none',
    color: '#aaa',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
};

export default Report;
