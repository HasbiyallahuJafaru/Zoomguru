// Surgical unit tests for session business logic
// No DB, no network — pure logic from session.service.ts

function formatDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '0 minutes';
  const mins = Math.round(seconds / 60);
  return `${mins} minute${mins !== 1 ? 's' : ''}`;
}

function buildTranscriptExport(session: {
  id: string;
  interview_type: string;
  started_at: string;
  duration_seconds: number | null;
  total_questions: number;
  summary: string | null;
}): string {
  const lines = [
    `ZoomGuru Interview Session Summary`,
    `Session ID: ${session.id}`,
    `Type: ${session.interview_type}`,
    `Date: ${new Date(session.started_at).toLocaleString()}`,
    `Duration: ${session.duration_seconds ? Math.round(session.duration_seconds / 60) + ' minutes' : 'N/A'}`,
    `Total Questions: ${session.total_questions}`,
    `---`,
    ``,
    session.summary || 'No summary available.',
    ``,
  ];
  return lines.join('\n');
}

function buildTranscriptText(
  messages: Array<{ role: string; content: string }>
): string {
  return messages
    .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
    .join('\n\n');
}

function truncateTranscript(text: string, maxLen = 6000): string {
  return text.slice(0, maxLen);
}

function isSessionOwner(sessionUserId: string, requestUserId: string): boolean {
  return sessionUserId === requestUserId;
}

function calcSessionStats(messages: Array<{ role: string; content: string }>): {
  totalQuestions: number;
  totalAnswers: number;
} {
  return {
    totalQuestions: messages.filter(m => m.role === 'user').length,
    totalAnswers: messages.filter(m => m.role === 'assistant').length,
  };
}

// ── formatDuration ────────────────────────────────────────────────────────────

describe('formatDuration', () => {
  it('formats 60 seconds as 1 minute', () => {
    expect(formatDuration(60)).toBe('1 minute');
  });

  it('formats 120 seconds as 2 minutes', () => {
    expect(formatDuration(120)).toBe('2 minutes');
  });

  it('rounds 90 seconds to 2 minutes', () => {
    expect(formatDuration(90)).toBe('2 minutes');
  });

  it('handles 0 seconds', () => {
    expect(formatDuration(0)).toBe('0 minutes');
  });

  it('handles negative (bad data)', () => {
    expect(formatDuration(-10)).toBe('0 minutes');
  });

  it('formats 3600 seconds as 60 minutes', () => {
    expect(formatDuration(3600)).toBe('60 minutes');
  });
});

// ── transcript export ─────────────────────────────────────────────────────────

describe('buildTranscriptExport', () => {
  const session = {
    id: 'sess-uuid-1',
    interview_type: 'behavioral',
    started_at: '2026-05-20T10:00:00.000Z',
    duration_seconds: 1800,
    total_questions: 12,
    summary: 'Candidate answered confidently.',
  };

  it('includes session ID', () => {
    expect(buildTranscriptExport(session)).toContain('sess-uuid-1');
  });

  it('includes interview type', () => {
    expect(buildTranscriptExport(session)).toContain('behavioral');
  });

  it('converts duration to minutes', () => {
    expect(buildTranscriptExport(session)).toContain('30 minutes');
  });

  it('includes total questions', () => {
    expect(buildTranscriptExport(session)).toContain('12');
  });

  it('includes summary', () => {
    expect(buildTranscriptExport(session)).toContain('answered confidently');
  });

  it('uses N/A for null duration', () => {
    const s = { ...session, duration_seconds: null };
    expect(buildTranscriptExport(s)).toContain('N/A');
  });

  it('uses fallback when no summary', () => {
    const s = { ...session, summary: null };
    expect(buildTranscriptExport(s)).toContain('No summary available.');
  });

  it('always starts with ZoomGuru header', () => {
    expect(buildTranscriptExport(session)).toMatch(/^ZoomGuru/);
  });
});

// ── transcript text builder ───────────────────────────────────────────────────

describe('buildTranscriptText', () => {
  const messages = [
    { role: 'user', content: 'Tell me about yourself.' },
    { role: 'assistant', content: 'I am a software engineer with 5 years of experience.' },
    { role: 'user', content: 'What is your biggest strength?' },
    { role: 'assistant', content: 'Problem solving and TypeScript.' },
  ];

  it('prefixes user messages with Q:', () => {
    expect(buildTranscriptText(messages)).toContain('Q: Tell me about yourself.');
  });

  it('prefixes assistant messages with A:', () => {
    expect(buildTranscriptText(messages)).toContain('A: I am a software engineer');
  });

  it('separates messages with double newline', () => {
    const text = buildTranscriptText(messages);
    expect(text).toContain('\n\n');
  });

  it('returns empty string for no messages', () => {
    expect(buildTranscriptText([])).toBe('');
  });
});

// ── transcript truncation ─────────────────────────────────────────────────────

describe('truncateTranscript', () => {
  it('truncates text longer than 6000 chars', () => {
    const long = 'x'.repeat(7000);
    expect(truncateTranscript(long)).toHaveLength(6000);
  });

  it('leaves short text unchanged', () => {
    const short = 'hello world';
    expect(truncateTranscript(short)).toBe(short);
  });

  it('handles exact boundary of 6000', () => {
    const exact = 'y'.repeat(6000);
    expect(truncateTranscript(exact)).toHaveLength(6000);
  });
});

// ── session ownership ─────────────────────────────────────────────────────────

describe('isSessionOwner', () => {
  it('returns true when user IDs match', () => {
    expect(isSessionOwner('uuid-1', 'uuid-1')).toBe(true);
  });

  it('returns false when user IDs differ', () => {
    expect(isSessionOwner('uuid-1', 'uuid-2')).toBe(false);
  });

  it('is case-sensitive', () => {
    expect(isSessionOwner('UUID-1', 'uuid-1')).toBe(false);
  });
});

// ── session stats ─────────────────────────────────────────────────────────────

describe('calcSessionStats', () => {
  it('counts user messages as questions', () => {
    const msgs = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'user', content: 'q2' },
    ];
    expect(calcSessionStats(msgs).totalQuestions).toBe(2);
  });

  it('counts assistant messages as answers', () => {
    const msgs = [
      { role: 'user', content: 'q1' },
      { role: 'assistant', content: 'a1' },
      { role: 'assistant', content: 'a2' },
    ];
    expect(calcSessionStats(msgs).totalAnswers).toBe(2);
  });

  it('returns zeros for empty message list', () => {
    const stats = calcSessionStats([]);
    expect(stats.totalQuestions).toBe(0);
    expect(stats.totalAnswers).toBe(0);
  });

  it('handles all-user messages', () => {
    const msgs = [
      { role: 'user', content: 'q1' },
      { role: 'user', content: 'q2' },
    ];
    expect(calcSessionStats(msgs)).toEqual({ totalQuestions: 2, totalAnswers: 0 });
  });
});
