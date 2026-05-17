import { useState } from 'react';

interface Props {
  onSubmit: (jd: string) => void;
}

export function JDInput({ onSubmit }: Props) {
  const [jd, setJd] = useState('');

  return (
    <div style={{ padding: '0 0 8px' }}>
      <h3 style={{ color: '#fff', marginBottom: 8, fontSize: 15, fontWeight: 600 }}>
        Job Description
        <span style={{ color: 'rgba(255,255,255,0.3)', fontWeight: 400, fontSize: 12, marginLeft: 8 }}>
          Optional
        </span>
      </h3>
      <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, marginBottom: 12 }}>
        Paste the job description to get more targeted answers.
      </p>

      <textarea
        value={jd}
        onChange={e => setJd(e.target.value)}
        placeholder="Paste the job description here to get more targeted answers..."
        style={{
          width: '100%',
          height: 120,
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.15)',
          borderRadius: 8,
          color: '#fff',
          padding: 12,
          resize: 'vertical',
          fontSize: 13,
          fontFamily: 'inherit',
          outline: 'none',
          lineHeight: 1.5,
        }}
        onFocus={e => (e.target.style.borderColor = 'rgba(59,130,246,0.5)')}
        onBlur={e => (e.target.style.borderColor = 'rgba(255,255,255,0.15)')}
      />

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <button
          onClick={() => onSubmit('')}
          style={{
            flex: 1,
            padding: '10px',
            background: 'rgba(255,255,255,0.07)',
            color: 'rgba(255,255,255,0.5)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
          }}
        >
          Skip
        </button>
        <button
          onClick={() => onSubmit(jd)}
          style={{
            flex: 2,
            padding: '10px 20px',
            background: '#3b82f6',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
