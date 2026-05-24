# PATCH-03 â€” Request Timeout on All AI API Calls

## Problem
If DeepSeek or Qwen API hangs, SSE connections hang forever.
Server memory leaks. Users see frozen overlay with no feedback.

## Files Affected
- `apps/backend/src/ai/ai.service.ts`

## Risk Level
ðŸŸ¡ MEDIUM â€” Modifies existing fetch calls. Test streaming after.

---

## Claude Code Prompt

```
Read .claude/AI.md and .claude/BACKEND.md first.

In apps/backend/src/ai/ai.service.ts, I need to add
AbortController timeouts to ALL fetch() calls that hit
external AI APIs (DeepSeek and Qwen).

For EACH fetch call in this file, wrap it like this pattern:

BEFORE (example):
  const response = await fetch('https://api.deepseek.com/...', {
    method: 'POST',
    headers: { ... },
    body: JSON.stringify({ ... }),
  });

AFTER:
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);
  
  let response: Response;
  try {
    response = await fetch('https://api.deepseek.com/...', {
      method: 'POST',
      headers: { ... },
      body: JSON.stringify({ ... }),
      signal: controller.signal,
    });
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err.name === 'AbortError') {
      reply.write(`data: ${JSON.stringify({ 
        error: 'AI response timed out. Please try again.', 
        done: true 
      })}\n\n`);
      reply.end();
      return;
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

Apply this pattern to:
1. The DeepSeek streaming fetch in streamAnswer()
2. The Qwen VL fetch in streamScreenshot()
3. The DeepSeek fetch in streamScreenshot()

Use 30000ms (30 seconds) timeout for all three.

Do NOT change any other logic, imports, or method signatures.
Do NOT change how chunks are streamed after the fetch.
Show me each change separately with its location in the file.
```

---

## Verification

```bash
# Temporarily point DeepSeek URL to a dead endpoint
# Start interview, trigger listen mode
# After 30 seconds, overlay should show timeout message
# Restore correct URL after testing
```

## Rollback
Remove AbortController blocks, restore original fetch calls.

