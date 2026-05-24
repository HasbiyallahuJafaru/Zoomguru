# PATCH-09 â€” SSE Connection Manager

## Problem
At 500 concurrent users, SSE connections accumulate without cleanup.
If a user disconnects mid-stream, the server keeps writing to a
dead connection â€” memory leak and error spam in logs.

## Files Affected
- `apps/backend/src/ai/sse-manager.ts` (new file)
- `apps/backend/src/ai/ai.controller.ts`

## Risk Level
ðŸŸ¡ MEDIUM â€” New file + controller modification. Test streaming after.

---

## Claude Code Prompt

```
Read .claude/BACKEND.md and .claude/AI.md first.

STEP 1 â€” Create a new file apps/backend/src/ai/sse-manager.ts
with exactly this content:

import { ServerResponse } from 'http';

/**
 * Manages active SSE connections.
 * Prevents memory leaks by cleaning up on client disconnect.
 * Ensures one active stream per user at a time.
 */
export class SSEManager {
  private connections = new Map<string, ServerResponse>();

  /**
   * Register a new SSE connection for a user.
   * Closes any existing connection for the same user first.
   */
  add(userId: string, res: ServerResponse): void {
    // Close existing connection if user reconnects
    const existing = this.connections.get(userId);
    if (existing && !existing.writableEnded) {
      existing.end();
    }
    this.connections.set(userId, res);

    // Auto-cleanup when client disconnects
    res.on('close', () => {
      if (this.connections.get(userId) === res) {
        this.connections.delete(userId);
      }
    });
  }

  /**
   * Remove a connection manually after stream ends.
   */
  remove(userId: string): void {
    this.connections.delete(userId);
  }

  /**
   * Total active SSE connections.
   */
  get size(): number {
    return this.connections.size;
  }
}

// Singleton instance
export const sseManager = new SSEManager();


STEP 2 â€” In apps/backend/src/ai/ai.controller.ts,
find the streamAnswer() method.

Add these two lines:
- AFTER reply.raw.writeHead(200, { ... }) 
  add: sseManager.add(req.user.userId, reply.raw);
- AFTER the await this.aiService.streamAnswer(...) call
  add: sseManager.remove(req.user.userId);

Do the same for streamScreenshot() method.

Add the import at the top of ai.controller.ts:
import { sseManager } from './sse-manager';

Do not change any other logic in the controller.
Show me the exact lines added in the controller.
```

---

## Verification

```bash
npm run start:dev

# Start a streaming request, then kill the client mid-stream
# Check server logs â€” should not show write-after-close errors
# sseManager.size should drop back to 0 after disconnect
```

## Rollback
Delete sse-manager.ts. Remove the two sseManager calls
from ai.controller.ts. Remove the import.

