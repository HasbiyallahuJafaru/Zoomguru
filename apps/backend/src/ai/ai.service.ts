import { Injectable, ForbiddenException } from '@nestjs/common';
import { ServerResponse } from 'http';
import { routeQuestion } from './question-router';
import { buildSystemPrompt } from './prompts';
import { getDB } from '../database/db';

@Injectable()
export class AiService {

  async streamAnswer(params: {
    userId: string;
    sessionId: string;
    transcript: string;
    reply: ServerResponse;
  }) {
    const { userId, sessionId, transcript, reply } = params;
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

    // 3. Route question
    const { model, systemPromptKey } = routeQuestion(transcript);

    // 4. Build system prompt with CV
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
    const response = await fetch('https://api.deepseek.com/chat/completions', {
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
    });

    if (!response.ok) {
      const errText = await response.text();
      reply.write(`data: ${JSON.stringify({ error: 'AI service error', done: true })}\n\n`);
      reply.end();
      throw new Error(`DeepSeek API error: ${errText}`);
    }

    // 7. Stream chunks to Electron
    let fullAnswer = '';
    const decoder = new TextDecoder();

    for await (const chunk of response.body as any) {
      const text = decoder.decode(chunk, { stream: true });
      const lines = text.split('\n').filter(l => l.startsWith('data: '));

      for (const line of lines) {
        const data = line.replace('data: ', '');
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

    // 9. Save to session history + increment usage (non-blocking)
    await Promise.all([
      sql`
        UPDATE interview_sessions
        SET
          messages = messages || ${JSON.stringify([
            { role: 'user', content: transcript, timestamp: new Date().toISOString() },
            { role: 'assistant', content: fullAnswer, timestamp: new Date().toISOString() }
          ])}::jsonb,
          total_questions = total_questions + 1
        WHERE id = ${sessionId} AND user_id = ${userId}
      `,
      this.incrementUsage(userId),
    ]);
  }

  async streamScreenshot(params: {
    userId: string;
    sessionId: string;
    image: string;
    voiceContext?: string;
    reply: ServerResponse;
  }) {
    const { userId, sessionId, image, voiceContext, reply } = params;

    await this.checkUsageLimit(userId);

    const sql = getDB();
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

    // Step 1: Qwen VL — understand the screenshot
    const visionResponse = await fetch(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.QWEN_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'qwen-vl-max',
          input: {
            messages: [{
              role: 'user',
              content: [
                { image: `data:image/png;base64,${image}` },
                { text: 'Describe exactly what is on this screen. If there is code, extract it completely. If there is a math problem, write it out. If there is a system design question, describe it. Be precise and complete.' }
              ]
            }]
          }
        }),
      }
    );

    let screenContent = '';
    if (visionResponse.ok) {
      const visionData = await visionResponse.json();
      screenContent = visionData.output?.choices?.[0]?.message?.content?.[0]?.text || '';
    } else {
      screenContent = voiceContext || 'Unable to analyze screenshot';
    }

    // Step 2: Determine question type from screen content
    const fullContext = voiceContext
      ? `Screen content: ${screenContent}\n\nVoice question: ${voiceContext}`
      : `Screen content: ${screenContent}`;

    const { model, systemPromptKey } = routeQuestion(screenContent + (voiceContext || ''));
    const systemPrompt = buildSystemPrompt(
      systemPromptKey,
      session.cv_profile,
      session.job_description,
      session.answer_length || 'standard'
    );

    // Step 3: DeepSeek solves it with streaming
    const aiResponse = await fetch('https://api.deepseek.com/chat/completions', {
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
    });

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
          const data = line.replace('data: ', '');
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
    }

    reply.write(`data: ${JSON.stringify({ chunk: '', done: true, fullAnswer })}\n\n`);
    reply.end();

    // Save and increment
    await Promise.all([
      sql`
        UPDATE interview_sessions
        SET
          messages = messages || ${JSON.stringify([
            { role: 'user', content: `[Screenshot] ${screenContent.slice(0, 500)}`, timestamp: new Date().toISOString() },
            { role: 'assistant', content: fullAnswer, timestamp: new Date().toISOString() }
          ])}::jsonb,
          total_questions = total_questions + 1
        WHERE id = ${sessionId} AND user_id = ${userId}
      `,
      this.incrementUsage(userId),
    ]);
  }

  async checkUsageLimit(userId: string): Promise<void> {
    const sql = getDB();
    const [usage] = await sql`
      SELECT u.is_pro, uu.sessions_used, uu.responses_used
      FROM users u
      LEFT JOIN user_usage uu ON uu.user_id = u.id
      WHERE u.id = ${userId}
    `;

    if (!usage) throw new ForbiddenException('User not found');
    if (usage.is_pro) return;

    if ((usage.responses_used || 0) >= 10) {
      throw new ForbiddenException('Free tier limit reached. Upgrade to continue.');
    }
  }

  async incrementUsage(userId: string): Promise<void> {
    const sql = getDB();
    await sql`
      UPDATE user_usage
      SET responses_used = responses_used + 1
      WHERE user_id = ${userId}
    `;
  }
}
