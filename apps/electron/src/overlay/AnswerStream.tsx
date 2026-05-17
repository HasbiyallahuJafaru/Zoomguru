interface Props {
  answer: string;
  isStreaming: boolean;
}

export function AnswerStream({ answer, isStreaming }: Props) {
  return (
    <div style={{
      flex: 1,
      padding: '16px',
      overflowY: 'auto',
      color: 'rgba(255,255,255,0.9)',
      fontSize: 14,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      fontFamily: 'system-ui, sans-serif',
    }}>
      {answer || (
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12 }}>
          Press ⌘⇧A to listen · ⌘⇧S to screenshot
        </span>
      )}
      {isStreaming && (
        <span style={{ animation: 'blink 1s infinite', display: 'inline-block' }}>▋</span>
      )}
    </div>
  );
}
