interface Props {
  answer: string;
  isStreaming: boolean;
}

export function AnswerStream({ answer, isStreaming }: Props) {
  return (
    <div style={{
      flex: 1,
      padding: '16px 20px',
      overflowY: 'auto',
      color: '#222',
      fontSize: 14,
      lineHeight: 1.65,
      whiteSpace: 'pre-wrap',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {answer ? (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 6, background: '#111',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, marginTop: 1,
          }}>
            <span style={{ color: '#fff', fontSize: 10, fontWeight: 900 }}>Z</span>
          </div>
          <span style={{ flex: 1 }}>
            {answer}
            {isStreaming && <span style={{ animation: 'blink 1s infinite', display: 'inline-block' }}>▋</span>}
          </span>
        </div>
      ) : (
        <span style={{ color: '#bbb', fontSize: 12 }}>
          Press ⌘⇧A to listen · ⌘⇧S to screenshot
        </span>
      )}
    </div>
  );
}
