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
      borderBottom: '1px solid #e5e5e5',
      background: '#fafaf8',
    }}>
      {modes.map(m => (
        <button
          key={m.key}
          onClick={() => onModeChange(m.key)}
          style={{
            padding: '4px 10px',
            borderRadius: 6,
            border: `1.5px solid ${mode === m.key ? '#111' : '#e5e5e5'}`,
            cursor: 'pointer',
            fontSize: 11,
            fontWeight: mode === m.key ? 700 : 400,
            background: mode === m.key ? '#111' : 'transparent',
            color: mode === m.key ? '#fff' : '#666',
            transition: 'all 0.12s',
            whiteSpace: 'nowrap',
            fontFamily: 'inherit',
          }}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
