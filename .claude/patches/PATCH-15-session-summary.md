# PATCH-15 — Session Summary Optimization (No Mid-Session DB Writes)

## Problem
Current system writes to DB on every Q&A pair.
10 questions = 10 DB writes per session.
At 500 users × 10 writes = 5,000 writes per session cycle.

## Fix
Messages live in Zustand (memory) during session.
On session end: one DB write with AI-generated summary only.

## Files Affected
- `apps/backend/src/ai/ai.service.ts`
- `apps/backend/src/session/session.service.ts`
- `apps/backend/src/session/session.controller.ts`
- `apps/backend/src/database/init.ts`

## Risk Level
🔴 HIGH — Core data flow change. Test end-to-end thoroughly.

---

## Claude Code Prompt

```
Read .claude/DATABASE.md, .claude/AI.md, .claude/BACKEND.md first.

This patch changes how session data is stored.
Apply each step carefully and do not skip any.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 1 — Update interview_sessions table schema
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/database/init.ts,
find the CREATE TABLE interview_sessions statement.

Remove this column if it exists:
  messages JSONB DEFAULT '[]'::jsonb,

Add this column if it does not exist:
  summary TEXT,
  duration_seconds INTEGER,

The final columns for interview_sessions should be:
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  interview_type TEXT DEFAULT 'general',
  answer_length TEXT DEFAULT 'standard',
  summary TEXT,
  total_questions INTEGER DEFAULT 0,
  duration_seconds INTEGER,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 — Remove mid-session DB writes from ai.service.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/ai/ai.service.ts,
find the streamAnswer() method.

At the end of streamAnswer(), find and REMOVE this block
(the part that saves messages to DB after each response):

  await sql`
    UPDATE interview_sessions
    SET messages = messages || ${JSON.stringify([...])}::jsonb
    ...
  `

Keep ONLY the incrementUsage() call:
  await this.incrementUsage(userId);

Do the same for streamScreenshot() — remove any mid-session
message append queries. Keep only incrementUsage().

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 — Add session/end endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/session/session.service.ts,
add this new method to the SessionService class:

  async endSession(params: {
    userId: string;
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
    durationSeconds: number;
    totalQuestions: number;
  }): Promise<void> {
    const sql = getDB();

    // Generate summary from messages using DeepSeek V3
    let summary = 'Session completed.';
    
    if (params.messages.length > 0) {
      const transcript = params.messages
        .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
        .join('\n\n')
        .slice(0, 6000); // cap to avoid large tokens

      try {
        const response = await fetch('https://api.deepseek.com/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
              {
                role: 'system',
                content: 'You are a concise interview analyst. Summarize this interview session in 3-5 sentences covering: types of questions asked, how well the candidate answered, and any notable strengths or gaps. Be honest and specific.',
              },
              { role: 'user', content: transcript },
            ],
            max_tokens: 300,
            temperature: 0.3,
          }),
        });
        const data = await response.json();
        summary = data.choices?.[0]?.message?.content || summary;
      } catch {
        // Summary generation failed — use default, don't block session end
      }
    }

    // Single write — summary only, no message history
    await sql`
      UPDATE interview_sessions
      SET
        summary = ${summary},
        total_questions = ${params.totalQuestions},
        duration_seconds = ${params.durationSeconds},
        ended_at = NOW()
      WHERE id = ${params.sessionId}
      AND user_id = ${params.userId}
    `;
  }

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 — Add POST /session/end endpoint
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
In apps/backend/src/session/session.controller.ts,
add this endpoint:

  @Post('end')
  @UseGuards(JwtAuthGuard)
  async endSession(@Request() req: any, @Body() body: {
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
    durationSeconds: number;
    totalQuestions: number;
  }) {
    await this.sessionService.endSession({
      userId: req.user.userId,
      ...body,
    });
    return { success: true };
  }

Show me all changed files with diffs.
```

---

## Electron Side (Call This on Session End)

```typescript
// In Overlay.tsx or session end handler
async function endInterview() {
  const { sessionId, messages, totalQuestions, sessionStartedAt } = useSessionStore.getState();
  
  const durationSeconds = sessionStartedAt
    ? Math.floor((Date.now() - new Date(sessionStartedAt).getTime()) / 1000)
    : 0;

  await fetch(`${API_URL}/session/end`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sessionId,
      messages,           // Full in-memory history sent once
      durationSeconds,
      totalQuestions,
    }),
  });

  // Clear in-memory session
  useSessionStore.getState().clearSession();
}
```

## Verification

```bash
# 1. Start interview session
# 2. Ask 5 questions
# 3. Check Neon DB mid-session → interview_sessions.summary should be NULL
# 4. End session
# 5. Check Neon DB → summary should be populated, ended_at set
# 6. Confirm NO messages column exists — all in Zustand only
```

## Rollback
Re-add messages column to CREATE TABLE.
Restore message append in ai.service.ts streamAnswer().
Remove endSession() method and endpoint.
