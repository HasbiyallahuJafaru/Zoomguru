type Mode = 'behavioral' | 'technical' | 'coding' | 'systemdesign';

interface Props {
  mode: Mode;
  onModeChange: (m: Mode) => void;
}

export function ModeBar({ mode, onModeChange }: Props) {
  const modes: { key: Mode; label: string }[] = [
    { key: 'behavioral', label: 'Behavioral' },
    { key: 'technical', label: 'Technical' },
    { key: 'coding', label: 'Coding' },
    { key: 'systemdesign', label: 'System Design' },
  ];

  return (
    <div style={{
      display: 'flex',
      gap: 4,
      padding: '8px 16px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
    }}>
      {modes.map(m => (
        <button
          key={m.key}
          onClick={() => onModeChange(m.key)}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: mode === m.key ? 600 : 400,
            background: mode === m.key ? 'rgba(59,130,246,0.8)' : 'rgba(255,255,255,0.08)',
            color: mode === m.key ? '#fff' : 'rgba(255,255,255,0.5)',
            transition: 'all 0.15s',
            whiteSpace: 'nowrap',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
