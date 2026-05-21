const testimonials = [
  {
    quote: 'I landed a Staff Engineer role at a top fintech. The system design question was brutal. ZoomGuru walked me through the architecture live. They had no idea.',
    name: 'Adewale O.',
    role: 'Staff Engineer, Lagos',
    avatar: 'AO',
  },
  {
    quote: 'Got the Google offer after bombing 3 previous attempts. Used ZoomGuru for the behavioral rounds. STAR answers personalized to my actual CV. Night and day difference.',
    name: 'Priya M.',
    role: 'Senior SWE, Bangalore',
    avatar: 'PM',
  },
  {
    quote: 'The LeetCode problem appeared on screen. I hit Ctrl+Shift+S. ZoomGuru identified it, explained the approach, and gave me working code in 8 seconds.',
    name: 'James K.',
    role: 'Frontend Engineer, London',
    avatar: 'JK',
  },
  {
    quote: 'Three offers in 2 weeks. Using ZoomGuru for every single interview. The invisibility feature works — tested it myself by screen-sharing to a friend.',
    name: 'Chidi A.',
    role: 'Full-stack Dev, Abuja',
    avatar: 'CA',
  },
];

export default function Testimonials() {
  return (
    <section style={{ padding: '96px 24px', borderTop: '1px solid #e5e5e5' }}>
      <div style={{ maxWidth: 1152, margin: '0 auto' }}>

        <div style={{ marginBottom: 56 }}>
          <p style={{ fontSize: 11, fontWeight: 700, color: '#999', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 12 }}>What people say</p>
          <h2 style={{ fontSize: 'clamp(28px,4vw,44px)', fontWeight: 900, color: '#111', letterSpacing: '-1.5px', lineHeight: 1.05 }}>
            Real results,<br />
            <span style={{ fontStyle: 'italic', fontWeight: 300 }}>real interviews.</span>
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {testimonials.map((t, i) => (
            <div key={i} style={{
              background: i === 0 ? '#111' : '#fff',
              border: '1.5px solid',
              borderColor: i === 0 ? '#111' : '#e5e5e5',
              borderRadius: 16, padding: 28,
              display: 'flex', flexDirection: 'column', gap: 20,
            }}>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: i === 0 ? 'rgba(255,255,255,0.85)' : '#333', flex: 1 }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 36, height: 36, borderRadius: '50%',
                  background: i === 0 ? 'rgba(255,255,255,0.15)' : '#f0f0f0',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: i === 0 ? '#fff' : '#555' }}>{t.avatar}</span>
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: i === 0 ? '#fff' : '#111' }}>{t.name}</p>
                  <p style={{ fontSize: 12, color: i === 0 ? 'rgba(255,255,255,0.5)' : '#888', marginTop: 1 }}>{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
