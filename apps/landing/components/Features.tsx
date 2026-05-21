const features = [
  {
    title: 'Personalized to your CV',
    description: 'Upload once. Every answer pulls from your real experience, projects, roles, and metrics. Sounds like you, not a generic template.',
    wide: true,
  },
  {
    title: 'Invisible to all screen share',
    description: 'OS-level window exclusion. Zoom, Meet, Teams, and browser tab share cannot capture the overlay.',
  },
  {
    title: 'Streams in under 500ms',
    description: 'First word in under 500ms. Answers stream word by word so you can start reading almost immediately.',
  },
  {
    title: 'Screenshot and vision AI',
    description: 'Capture your screen with a hotkey. AI reads whiteboard problems, LeetCode windows, and diagrams.',
  },
  {
    title: 'Local speech transcription',
    description: 'Whisper tiny model runs entirely on device. Audio never leaves your machine.',
  },
  {
    title: 'Deep reasoning for hard questions',
    description: 'Coding, system design, and math auto-route to DeepSeek R1. Behavioral questions use the faster V3 model.',
    wide: true,
  },
  {
    title: 'Full session memory',
    description: 'ZoomGuru tracks the full conversation. Follow-up questions get answers that build on everything said earlier.',
  },
  {
    title: 'Mac and Windows native',
    description: 'Packaged as a native .dmg for macOS and .exe for Windows 10/11. One device-locked license per machine.',
  },
];

export default function Features() {
  return (
    <section id="features" style={{ padding: '96px 24px', borderTop: '1px solid #e5e5e5' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto' }}>

        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>Features</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#111', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Everything you need.<br />
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>Nothing you don't.</span>
          </h2>
        </div>

        <div className="grid-features">
          {features.map((f, i) => (
            <div key={i} className={f.wide ? 'wide-card' : ''} style={{
              background: i % 3 === 0 ? '#111' : '#fff',
              border: '1.5px solid',
              borderColor: i % 3 === 0 ? '#111' : '#e5e5e5',
              borderRadius: 16, padding: 28,
            }}>
              <h3 style={{ fontSize: 16, fontWeight: 700, color: i % 3 === 0 ? '#fff' : '#111', letterSpacing: '-0.3px', marginBottom: 10 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: i % 3 === 0 ? 'rgba(255,255,255,0.6)' : '#555', lineHeight: 1.65 }}>{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
