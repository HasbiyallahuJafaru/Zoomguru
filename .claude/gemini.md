━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SESSION STARTER — Paste this FIRST
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read .claude/BIBLE.md first.
Read .claude/CLAUDE.md second.
Read .claude/BACKEND.md third.

Rules:
- Complete files only. First line to last line.
- tsc --noEmit must pass after every file.
- State what you will import and export BEFORE generating.
- One file per prompt. Confirm before next.
- No TODOs. No placeholders. No assumed APIs.

Context for this session:
We are switching the AI service to use Google Gemini Flash
as the primary provider for both transcription and vision,
with Groq as an automatic fallback if Gemini fails or returns
a non-200 response. DeepSeek round-robin (5 keys) for text
answers is already implemented and must not be touched.

Before generating any code, manually add this line to
apps/backend/.env and to your Render environment variables:
  GEMINI_API_KEY=<your key from aistudio.google.com>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 1 of 2 — apps/backend/src/main.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read .claude/BACKEND.md.
Read the current apps/backend/src/main.ts in full.

Generate COMPLETE apps/backend/src/main.ts

Requirements:
- Everything in the current file stays identical
- Add 'GEMINI_API_KEY' to the REQUIRED array alongside
  DATABASE_URL, JWT_SECRET, DEEPSEEK_API_KEY, GROQ_API_KEY,
  PAYSTACK_SECRET_KEY
- No other changes

Pre-declaration:
  Imports from: dotenv/config, @nestjs/core,
    @nestjs/platform-fastify, ./app.module, ./database/init
  Exports: nothing (bootstrap entry point)
  Change: REQUIRED array gains one entry

Generate complete file. Then run:
npx tsc --noEmit
Zero errors before moving to File 2.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FILE 2 of 2 — apps/backend/src/ai/ai.service.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Read .claude/BACKEND.md.
Read the current apps/backend/src/ai/ai.service.ts in full.

Generate COMPLETE apps/backend/src/ai/ai.service.ts

Requirements — keep everything that already exists:
- DeepSeek round-robin across DEEPSEEK_API_KEY through
  DEEPSEEK_API_KEY_5. Do not touch this logic at all.
- buildSystemPrompt, buildVisionPrompt, stripInjection,
  truncateAtWord, routeModel, buildBody — all unchanged.
- streamAnswer (text) — unchanged.

Requirements — replace Groq transcription with Gemini primary:

Method: transcribe(params: { audio: string }): Promise<string>

  STEP 1 — Try Gemini Flash first:
    Endpoint:
      POST https://generativelanguage.googleapis.com/v1beta/
      models/gemini-2.0-flash:generateContent?key=GEMINI_API_KEY
    Headers: Content-Type: application/json
    Body:
      {
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: "audio/webm",
                data: "<base64 audio string>"
              }
            },
            {
              text: "Transcribe this audio exactly as spoken.
                     Return only the transcribed words.
                     No commentary, no labels, no punctuation
                     beyond what was spoken."
            }
          ]
        }]
      }
    Response shape:
      { candidates: [{ content: { parts: [{ text: string }] } }] }
    Extract: candidates[0].content.parts[0].text.trim()
    Timeout: 20 seconds via AbortController

  STEP 2 — Fall back to Groq if Gemini throws OR returns non-200:
    Groq Whisper endpoint (same as current implementation):
      POST https://api.groq.com/openai/v1/audio/transcriptions
      model: whisper-large-v3-turbo
      Authorization: Bearer GROQ_API_KEY
    This is the exact same Groq transcription logic that exists
    in the file today. Copy it verbatim as the fallback.

  Error handling:
    If both Gemini and Groq fail, throw the Groq error.
    If audio.length > 5_000_000, throw HttpException 400
    before attempting either provider.

Requirements — replace Groq vision with Gemini primary:

Method: streamScreenshot — rename private helper to
  streamToGeminiVision with Groq fallback:

  STEP 1 — Try Gemini Flash streaming first:
    Endpoint:
      POST https://generativelanguage.googleapis.com/v1beta/
      models/gemini-2.0-flash:streamGenerateContent?alt=sse
      &key=GEMINI_API_KEY
    Headers: Content-Type: application/json
    Body:
      {
        contents: [{
          parts: [
            {
              inline_data: {
                mime_type: "image/png",
                data: "<base64 image string>"
              }
            },
            { text: "<result of buildVisionPrompt(cvText, jdText)>" }
          ]
        }],
        generationConfig: { maxOutputTokens: 800 }
      }
    Gemini SSE chunk shape:
      data: { "candidates": [{ "content":
        { "parts": [{ "text": "..." }] } }] }
    Extract per chunk: candidates[0]?.content?.parts?.[0]?.text
    Map each non-empty chunk to ZoomGuru SSE format:
      reply.write(`data: ${JSON.stringify(
        { chunk: text, done: false })}\n\n`)
    End: reply.write(`data: ${JSON.stringify(
      { done: true })}\n\n`); reply.end()
    Timeout: 30 seconds via AbortController
    Image size guard: if imageBase64.length > 10_000_000,
      write error chunk and end — same as current code.

  STEP 2 — Fall back to Groq vision if Gemini fetch throws
    OR response.status is not 200:
    Use the exact Groq vision logic that exists in the file
    today (streamToGroqVision). Copy it verbatim as the
    fallback path. It writes directly to reply and ends it.

  Important: Gemini fallback detection must happen BEFORE
  any bytes are written to reply. Check response.status
  immediately after fetch resolves. If non-200, call the
  Groq fallback without having written anything to reply yet.

Pre-declaration:
  Imports from: @nestjs/common, http (Node built-in)
  Exports: AiService class
  New env vars read: process.env['GEMINI_API_KEY']
  Existing env vars kept: DEEPSEEK_API_KEY through
    DEEPSEEK_API_KEY_5, GROQ_API_KEY
  New interfaces needed:
    GeminiResponse: {
      candidates: Array<{
        content: { parts: Array<{ text: string }> }
      }>
    }
    GeminiStreamChunk: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }

Generate complete file. Then run:
npx tsc --noEmit
Zero errors = done. Commit and push.