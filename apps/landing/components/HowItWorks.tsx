const steps = [
  {
    number: '01',
    title: 'Upload your CV',
    description: 'ZoomGuru reads your resume and builds a personalized profile from your experience, projects, tech stack, and achievements. Every answer sounds like you.',
    detail: 'PDF, DOCX, and plain text supported',
  },
  {
    number: '02',
    title: 'Open your video call',
    description: 'Launch Zoom, Google Meet, Teams, or Webex. ZoomGuru floats as a transparent overlay. Only you can see it. Your interviewer sees absolutely nothing unusual.',
    detail: 'Works with Zoom, Meet, Teams, Webex, and any app',
  },
  {
    number: '03',
    title: 'Trigger on any question',
    description: 'Press a hotkey to listen or capture your screen. The AI understands the question and streams a personalized answer in under a second.',
    detail: 'First word under 500ms, streams word by word',
  },
  {
    number: '04',
    title: 'Deliver the answer',
    description: 'Read naturally as the answer streams onto your overlay. Speak with confidence. The interviewer sees only you — calm, articulate, prepared.',
    detail: 'Behavioral, technical, coding, and system design',
  },
];

export default function HowItWorks() {
  return (
    <section id="how-it-works" style={{ padding: '96px 24px', borderTop: '1px solid #e5e5e5' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>How it works</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#111', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Up and running<br />
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>in under 2 minutes.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 1, background: '#e5e5e5', border: '1.5px solid #e5e5e5', borderRadius: 16, overflow: 'hidden' }}>
          {steps.map((step, i) => (
            <div key={i} style={{ background: '#fff', padding: 28, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <span style={{ fontSize: 11, fontWeight: 800, color: '#bbb', letterSpacing: '0.1em', fontFamily: 'monospace' }}>{step.number}</span>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111', letterSpacing: '-0.3px' }}>{step.title}</h3>
              <p style={{ fontSize: 14, color: '#555', lineHeight: 1.65, flex: 1 }}>{step.description}</p>
              <p style={{ fontSize: 11, fontWeight: 600, color: '#999', borderTop: '1px solid #f0f0f0', paddingTop: 12 }}>{step.detail}</p>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 40, textAlign: 'center' }}>
          <a href="/pricing" style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: '#111', color: '#fff', fontWeight: 700, fontSize: 15,
            padding: '14px 32px', borderRadius: 14, textDecoration: 'none',
          }}>Get started free →</a>
        </div>
      </div>
    </section>
  );
}
