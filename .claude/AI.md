# ZoomGuru — AI Layer

## Models Used

| Model | Provider | Use Case | Runs |
|-------|----------|----------|------|
| `deepseek-chat` (V3) | DeepSeek | Behavioral, conversational, technical definitions, screenshot vision | Backend (API) |
| `deepseek-reasoner` (R1) | DeepSeek | Coding, system design, math, complex reasoning | Backend (API) |
| Whisper tiny (ONNX) | OpenAI (local) | Speech-to-text transcription in Electron | Electron (local) |
| Porcupine | Picovoice (local) | Wake word "Hey ZoomGuru" | Electron (local) |

**All AI API calls go through the backend. Electron never calls DeepSeek directly.**

> **Deprecation notice:** `deepseek-chat` and `deepseek-reasoner` are deprecated on **July 24, 2026**.
> Migrate to `deepseek-v4-flash` (chat) and `deepseek-v4-pro` (reasoner) before that date.

---

## API Keys Required

```env
DEEPSEEK_API_KEY=sk-xxxx    # platform.deepseek.com
```

---

## API Endpoints

```
DeepSeek V3 + R1 + Vision:  POST https://api.deepseek.com/chat/completions
```

---

## Question Router

File: `apps/backend/src/ai/question-router.ts`

Routes each transcript to the correct model and format:

| Trigger type | Model | Format |
|-------------|-------|--------|
| Coding keywords | `deepseek-reasoner` | code + complexity |
| System design keywords | `deepseek-reasoner` | structured architecture |
| Math keywords | `deepseek-reasoner` | step-by-step |
| Behavioral keywords | `deepseek-chat` | STAR method |
| Everything else | `deepseek-chat` | concise technical |

**Behavioral triggers:** "tell me about yourself", "describe a time", "greatest weakness", "leadership", "conflict with", etc.

**Coding triggers:** "write a function", "implement", "algorithm", "time complexity", "leetcode", "binary search", "dynamic programming", etc.

**System design triggers:** "design a system", "how would you architect", "microservices", "load balancer", "database sharding", etc.

**Math triggers:** "calculate", "probability", "prove that", "expected value", "permutation", etc.

---

## System Prompts

File: `apps/backend/src/ai/prompts.ts`

Every prompt is personalized with the user's CV profile. The AI answers **as the candidate in first person** — it never fabricates experience, only references what's in the CV.

**Answer length options:** `brief` (under 3 sentences) | `standard` (4–6 sentences) | `detailed` (full explanation)

**Format per question type:**
- `behavioral` — STAR method (natural storytelling, no explicit labels)
- `technical` — direct explanation with analogies
- `coding` — approach → clean commented code → time/space complexity → edge cases
- `systemdesign` — requirements → architecture → components → data model → bottlenecks
- `math` — step-by-step working, stated assumptions, answer check

---

## Streaming Flow (Voice/Text)

File: `apps/backend/src/ai/ai.service.ts` — `streamAnswer()`

```
Electron sends transcript → POST /ai/stream (SSE)
        ↓
1. Check usage limits (free: 10 responses/session)
2. Load session: CV profile + message history from DB
3. Route question → model + format
4. Build system prompt with CV context
5. POST to DeepSeek with stream: true
6. Stream SSE chunks → Electron (each word as it arrives)
7. Send { done: true } signal
8. Save Q+A to session history, increment usage counter
```

First word arrives in **under 500ms**. Full answer streams word-by-word.

---

## Screenshot / Vision Flow

File: `apps/backend/src/ai/ai.service.ts` — `streamScreenshot()`

```
Electron sends base64 screenshot → POST /ai/screenshot (SSE)
        ↓
1. Check usage limits
2. POST image to DeepSeek V3 (vision) → extracts screen content as text
   (code, math problems, diagrams, LeetCode windows, etc.)
3. Combine extracted content + optional voice context
4. Route to correct model via question router
5. POST to DeepSeek with stream: true
6. Stream SSE chunks → Electron
```

Screenshot mode is **Pro only** — free tier returns 403.

---

## Usage Limits

| Tier | Sessions | Responses/session | Screenshot |
|------|----------|-------------------|------------|
| Free | 3 total | 10 | No |
| Pro | Unlimited | Unlimited | Yes |

Checked in `checkUsageLimit()` before every AI call. Pro users bypass all limits.

---

## Session Memory

Each `interview_session` row stores a `messages` JSONB array — the full conversation history.

Every AI call appends `{ role: 'user', content: transcript }` and `{ role: 'assistant', content: fullAnswer }` to the session. Follow-up questions get answers that build on everything said earlier in the session.
