import { Injectable, ForbiddenException } from '@nestjs/common';
import { ServerResponse } from 'http';
import { routeQuestion, RouteResult } from './question-router';
import { buildSystemPrompt } from './prompts';
import { getDB } from '../database/db';

const EXPLICIT_MODES = new Set(['behavioral', 'technical', 'coding', 'systemdesign']);

function resolveRoute(transcript: string, mode?: string): RouteResult {
  if (mode && EXPLICIT_MODES.has(mode)) {
    switch (mode) {
      case 'behavioral':
        return { model: 'deepseek-chat', format: 'star', systemPromptKey: 'behavioral' };
      case 'coding':
        return { model: 'deepseek-reasoner', format: 'code', systemPromptKey: 'coding' };
      case 'systemdesign':
        return { model: 'deepseek-reasoner', format: 'structured', systemPromptKey: 'systemdesign' };
      case 'technical':
        return { model: 'deepseek-chat', format: 'concise', systemPromptKey: 'technical' };
    }
  }
  return routeQuestion(transcript);
}

@Injectable()
export class AiService {

  async streamAnswer(params: {
    userId: string;
    sessionId: string;
    transcript: string;
    mode?: string;
    reply: ServerResponse;
  }) {
    const { userId, sessionId, transcript, mode, reply } = params;
    const sql = getDB();

    // 1. Check usage limits
    await this.checkUsageLimit(userId);

    // 2. Load session (CV + history)
    const [session] = await sql`
      SELECT cv_profile, job_description, messages, interview_type, answer_length
      FROM interview_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (!session) throw new ForbiddenException('Session not found');

    // 3. Route question — use explicit mode if provided, otherwise auto-detect
    const { model, systemPromptKey } = resolveRoute(transcript, mode);

    // 4. Build system prompt with CV (cv_profile is nullable — guard before calling)
    if (!session.cv_profile) {
      reply.write(`data: ${JSON.stringify({ error: 'No CV uploaded. Please upload your CV before using ZoomGuru.', done: true })}\n\n`);
      reply.end();
      return;
    }
    const systemPrompt = buildSystemPrompt(
      systemPromptKey,
      session.cv_profile,
      session.job_description,
      session.answer_length || 'standard'
    );

    // 5. Build message history (limit to last 20 to avoid token overflow)
    const history = (session.messages || []).slice(-20);
    const messages = [
      ...history,
      { role: 'user', content: transcript }
    ];

    // 6. Call DeepSeek with streaming
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    let response: Response;
    try {
      response = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            ...messages,
          ],
          stream: true,
          temperature: 0.7,
          max_tokens: 1500,
        }),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        reply.write(`data: ${JSON.stringify({ error: 'AI response timed out. Please try again.', done: true })}\n\n`);
        reply.end();
        return;
      }
      throw err;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errText = await response.text();
      reply.write(`data: ${JSON.stringify({ error: 'AI service error', done: true })}\n\n`);
      reply.end();
      return;
    }

    // 7. Stream chunks to Electron
    let fullAnswer = '';
    const decoder = new TextDecoder();

    for await (const chunk of response.body as any) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.slice(6);
        if (data === '[DONE]') continue;

        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            fullAnswer += content;
            reply.write(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`);
          }
        } catch {
          // Ignore parse errors on partial chunks
        }
      }
    }

    // 8. Done signal
    reply.write(`data: ${JSON.stringify({ chunk: '', done: true, fullAnswer })}\n\n`);
    reply.end();

    // 9. Append Q&A turn to server-side message log
    await sql`
      UPDATE interview_sessions
      SET messages = COALESCE(messages, '[]'::jsonb) ||
        ${JSON.stringify([
          { role: 'user', content: transcript },
          { role: 'assistant', content: fullAnswer },
        ])}::jsonb
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    // 10. Increment usage
    await this.incrementUsage(userId);
  }

  async streamScreenshot(params: {
    userId: string;
    sessionId: string;
    image: string;
    voiceContext?: string;
    mode?: string;
    reply: ServerResponse;
  }) {
    const { userId, sessionId, image, voiceContext, mode, reply } = params;

    await this.checkUsageLimit(userId);

    const sql = getDB();

    // Screenshot mode is pro-only
    const [userRow] = await sql`SELECT is_pro FROM users WHERE id = ${userId}`;
    if (!userRow?.is_pro) {
      reply.write(`data: ${JSON.stringify({ error: 'Screenshot mode requires a Pro plan. Upgrade to continue.', done: true })}\n\n`);
      reply.end();
      return;
    }

    const [session] = await sql`
      SELECT cv_profile, job_description, answer_length
      FROM interview_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (!session) {
      reply.write(`data: ${JSON.stringify({ error: 'Session not found', done: true })}\n\n`);
      reply.end();
      return;
    }

    // Guard before any API calls — no point spending vision credits if CV is missing
    if (!session.cv_profile) {
      reply.write(`data: ${JSON.stringify({ error: 'No CV uploaded. Please upload your CV before using ZoomGuru.', done: true })}\n\n`);
      reply.end();
      return;
    }

    // Step 1: DeepSeek vision — understand the screenshot
    const visionController = new AbortController();
    const visionTimeoutId = setTimeout(() => visionController.abort(), 30000);

    let visionResponse: Response;
    try {
      visionResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [{
            role: 'user',
            content: [
              { type: 'image_url', image_url: { url: `data:image/png;base64,${image}` } },
              { type: 'text', text: 'Describe exactly what is on this screen. If there is code, extract it completely. If there is a math problem, write it out. If there is a system design question, describe it. Be precise and complete.' }
            ]
          }],
          max_tokens: 1000,
        }),
        signal: visionController.signal,
      });
    } catch (err: any) {
      clearTimeout(visionTimeoutId);
      if (err.name === 'AbortError') {
        reply.write(`data: ${JSON.stringify({ error: 'AI response timed out. Please try again.', done: true })}\n\n`);
        reply.end();
        return;
      }
      throw err;
    } finally {
      clearTimeout(visionTimeoutId);
    }

    let screenContent = '';
    if (visionResponse.ok) {
      const visionData = await visionResponse.json();
      screenContent = visionData.choices?.[0]?.message?.content || '';
    } else {
      screenContent = voiceContext || 'Unable to analyze screenshot';
    }

    // Step 2: Route using explicit mode if provided, otherwise auto-detect from screen content
    const fullContext = voiceContext
      ? `Screen content: ${screenContent}\n\nVoice question: ${voiceContext}`
      : `Screen content: ${screenContent}`;

    const { model, systemPromptKey } = resolveRoute(
      screenContent + (voiceContext || ''),
      mode
    );
    const systemPrompt = buildSystemPrompt(
      systemPromptKey,
      session.cv_profile,
      session.job_description,
      session.answer_length || 'standard'
    );

    // Step 3: DeepSeek solves it with streaming
    const aiController = new AbortController();
    const aiTimeoutId = setTimeout(() => aiController.abort(), 30000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch('https://api.deepseek.com/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: fullContext }
          ],
          stream: true,
          max_tokens: 2000,
        }),
        signal: aiController.signal,
      });
    } catch (err: any) {
      clearTimeout(aiTimeoutId);
      if (err.name === 'AbortError') {
        reply.write(`data: ${JSON.stringify({ error: 'AI response timed out. Please try again.', done: true })}\n\n`);
        reply.end();
        return;
      }
      throw err;
    } finally {
      clearTimeout(aiTimeoutId);
    }

    // Send screen analysis summary first
    const preview = screenContent.length > 100
      ? screenContent.slice(0, 100) + '...'
      : screenContent;
    reply.write(`data: ${JSON.stringify({ chunk: `Detected: ${preview}\n\n`, done: false })}\n\n`);

    // Stream response
    let fullAnswer = '';
    const decoder = new TextDecoder();

    if (aiResponse.ok) {
      for await (const chunk of aiResponse.body as any) {
        const text = decoder.decode(chunk, { stream: true });
        const lines = text.split('\n').filter(l => l.startsWith('data: '));

        for (const line of lines) {
          const data = line.slice(6);
          if (data === '[DONE]') continue;
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullAnswer += content;
              reply.write(`data: ${JSON.stringify({ chunk: content, done: false })}\n\n`);
            }
          } catch {
            // Ignore parse errors
          }
        }
      }
    } else {
      reply.write(`data: ${JSON.stringify({ error: 'AI service error. Please try again.', done: true })}\n\n`);
      reply.end();
      return;
    }

    reply.write(`data: ${JSON.stringify({ chunk: '', done: true, fullAnswer })}\n\n`);
    reply.end();

    // Append screenshot Q&A turn to server-side message log
    const screenshotPrompt = voiceContext
      ? `[Screenshot] ${voiceContext}`
      : '[Screenshot analysis]';
    await sql`
      UPDATE interview_sessions
      SET messages = COALESCE(messages, '[]'::jsonb) ||
        ${JSON.stringify([
          { role: 'user', content: screenshotPrompt },
          { role: 'assistant', content: fullAnswer },
        ])}::jsonb
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    // Increment usage
    await this.incrementUsage(userId);
  }

  async checkUsageLimit(userId: string): Promise<void> {
    const sql = getDB();
    const [user] = await sql`SELECT is_pro FROM users WHERE id = ${userId}`;
    if (!user) throw new ForbiddenException('User not found');
    if (user.is_pro) return;

    // Atomic increment-and-check: only succeeds if under the limit
    const [row] = await sql`
      INSERT INTO user_usage (user_id, responses_used)
      VALUES (${userId}, 1)
      ON CONFLICT (user_id) DO UPDATE
      SET responses_used = user_usage.responses_used + 1
      WHERE user_usage.responses_used < 10
      RETURNING responses_used
    `;
    if (!row) {
      throw new ForbiddenException('Free tier limit reached: 10 responses used this session. Upgrade to continue.');
    }
  }

  // incrementUsage is now merged into checkUsageLimit above — kept as no-op for call-site compatibility
  async incrementUsage(_userId: string): Promise<void> {}
}
