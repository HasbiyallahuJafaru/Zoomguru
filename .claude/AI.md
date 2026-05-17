# ZoomGuru — AI Layer

## Models Used

| Model | Provider | Use Case | Speed |
|-------|----------|----------|-------|
| `deepseek-chat` (V3) | DeepSeek | Behavioral, conversational, technical definitions | Fast |
| `deepseek-reasoner` (R1) | DeepSeek | Coding, system design, math, complex reasoning | Slower but thorough |
| Qwen VL | Alibaba Cloud | Screenshot vision — reads screen content | Medium |
| Whisper tiny | OpenAI (local ONNX) | Speech-to-text in Electron — never hits API | Instant (local) |
| Porcupine | Picovoice (local) | Wake word "Hey ZoomGuru" — local only | Instant (local) |

**API Keys required:**
- `DEEPSEEK_API_KEY` — from platform.deepseek.com
- `QWEN_API_KEY` — from dashscope.aliyuncs.com

---

## DeepSeek API Base URLs

```
DeepSeek V3: https://api.deepseek.com/chat/completions
DeepSeek R1: https://api.deepseek.com/chat/completions (model: deepseek-reasoner)
Qwen VL:     https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation
```

---

## Question Router (ai/question-router.ts)

```typescript
export type QuestionType =
  | 'behavioral'
  | 'technical'
  | 'coding'
  | 'systemdesign'
  | 'math'
  | 'screenshot';

export type ModelChoice = 'deepseek-chat' | 'deepseek-reasoner';

interface RouteResult {
  model: ModelChoice;
  format: string;
  systemPromptKey: string;
}

const BEHAVIORAL_TRIGGERS = [
  'tell me about yourself', 'describe a time', 'how do you handle',
  'greatest weakness', 'greatest strength', 'why did you leave',
  'where do you see yourself', 'why do you want', 'what motivates',
  'conflict with', 'challenging situation', 'proud of', 'failure',
  'leadership', 'teamwork', 'disagreement',
];

const CODING_TRIGGERS = [
  'write a function', 'implement', 'solve this', 'algorithm',
  'time complexity', 'space complexity', 'optimize', 'refactor',
  'debug this', 'whats wrong with', 'leetcode', 'hackerrank',
  'binary search', 'dynamic programming', 'recursion', 'linked list',
];

const SYSTEM_DESIGN_TRIGGERS = [
  'design a system', 'how would you architect', 'scale this',
  'design twitter', 'design uber', 'design netflix', 'design whatsapp',
  'microservices', 'load balancer', 'database sharding', 'caching strategy',
  'how would you build', 'system design',
];

const MATH_TRIGGERS = [
  'calculate', 'probability', 'how many ways', 'prove that',
  'derive', 'what is the formula', 'expected value', 'permutation',
  'combination', 'statistics', 'regression',
];

export function routeQuestion(transcript: string): RouteResult {
  const lower = transcript.toLowerCase();

  if (CODING_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-reasoner', format: 'code', systemPromptKey: 'coding' };
  }

  if (SYSTEM_DESIGN_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-reasoner', format: 'structured', systemPromptKey: 'systemdesign' };
  }

  if (MATH_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-reasoner', format: 'stepbystep', systemPromptKey: 'math' };
  }

  if (BEHAVIORAL_TRIGGERS.some(t => lower.includes(t))) {
    return { model: 'deepseek-chat', format: 'star', systemPromptKey: 'behavioral' };
  }

  // Default — technical/general
  return { model: 'deepseek-chat', format: 'concise', systemPromptKey: 'technical' };
}
```

---

## System Prompts (ai/prompts.ts)

```typescript
export function buildSystemPrompt(
  promptKey: string,
  cvProfile: CVProfile,
  jobDescription?: string,
  answerLength: 'brief' | 'standard' | 'detailed' = 'standard'
): string {
  const lengthInstruction = {
    brief: 'Keep answers under 3 sentences. Punchy and direct.',
    standard: 'Aim for 4-6 sentences. Clear and complete.',
    detailed: 'Be thorough. Full explanation with examples where relevant.',
  }[answerLength];

  const cvContext = buildCVContext(cvProfile);
  const jdContext = jobDescription
    ? `\n\nJOB DESCRIPTION:\n${jobDescription}\nTailor all answers to match this role's requirements.`
    : '';

  const base = `You are an AI interview assistant helping ${cvProfile.name} succeed in their interview.
Answer ALL questions as if you ARE ${cvProfile.name}, speaking confidently in first person.
Never fabricate experience. Only reference what is in the CV below.
If asked about something not in the CV, briefly acknowledge and pivot to relevant experience.

${lengthInstruction}

${cvContext}${jdContext}`;

  const formatInstructions: Record<string, string> = {
    behavioral: `${base}

FORMAT: Use the STAR method (Situation, Task, Action, Result) for behavioral questions.
Keep it natural — don't label the sections explicitly. Just tell the story.`,

    technical: `${base}

FORMAT: Direct, clear explanation. Use simple analogies when helpful.
Show depth of understanding, not just surface definitions.`,

    coding: `${base}

FORMAT: 
1. Briefly state your approach/intuition (2-3 sentences)
2. Write clean, commented code
3. State time and space complexity
4. Mention edge cases you'd handle

Speak the approach out loud naturally, then show the code.`,

    systemdesign: `${base}

FORMAT:
1. Clarify requirements (scale, read/write ratio, consistency needs)
2. High-level architecture (2-3 sentences)
3. Key components and why
4. Data model
5. Bottlenecks and how you'd address them

Be structured and think out loud.`,

    math: `${base}

FORMAT: Show your working step by step.
State assumptions clearly. Check your answer at the end.`,
  };

  return formatInstructions[promptKey] || formatInstructions.technical;
}

function buildCVContext(cv: CVProfile): string {
  return `CANDIDATE PROFILE:
Name: ${cv.name}
Current Role: ${cv.currentRole}
Years of Experience: ${cv.yearsExperience}
Skills: ${cv.skills.join(', ')}

Work History:
${cv.companies.map(c =>
  `- ${c.role} at ${c.name} (${c.duration})\n  ${c.achievements.join('\n  ')}`
).join('\n')}

Projects:
${cv.projects.map(p =>
  `- ${p.name}: ${p.description} (Stack: ${p.stack.join(', ')}) — ${p.impact}`
).join('\n')}

Education:
${cv.education.map(e => `- ${e.degree} from ${e.institution} (${e.year})`).join('\n')}

Certifications: ${cv.certifications.join(', ')}`;
}
```

---

## Streaming to SSE (ai/ai.service.ts)

```typescript
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
      SELECT cv_profile, job_description, messages, interview_type
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
      session.job_description
    );

    // 5. Build message history
    const messages = [
      ...session.messages,
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

    // 7. Stream chunks to Electron
    let fullAnswer = '';
    const decoder = new TextDecoder();

    for await (const chunk of response.body as any) {
      const text = decoder.decode(chunk);
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
        } catch {}
      }
    }

    // 8. Done signal
    reply.write(`data: ${JSON.stringify({ chunk: '', done: true, fullAnswer })}\n\n`);
    reply.end();

    // 9. Save to session history + increment usage
    await Promise.all([
      sql`
        UPDATE interview_sessions
        SET messages = messages || ${JSON.stringify([
          { role: 'user', content: transcript },
          { role: 'assistant', content: fullAnswer }
        ])}::jsonb
        WHERE id = ${sessionId}
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
      SELECT cv_profile, job_description
      FROM interview_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

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

    const visionData = await visionResponse.json();
    const screenContent = visionData.output?.choices?.[0]?.message?.content?.[0]?.text || '';

    // Step 2: Determine question type from screen content
    const fullContext = voiceContext
      ? `Screen content: ${screenContent}\n\nVoice question: ${voiceContext}`
      : `Screen content: ${screenContent}`;

    const { model, systemPromptKey } = routeQuestion(screenContent + (voiceContext || ''));
    const systemPrompt = buildSystemPrompt(systemPromptKey, session.cv_profile, session.job_description);

    // Step 3: DeepSeek R1 solves it
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

    // Stream response
    let fullAnswer = '';
    const decoder = new TextDecoder();

    // Send screen analysis first
    reply.write(`data: ${JSON.stringify({ chunk: `📸 Detected: ${screenContent.slice(0, 100)}...\n\n`, done: false })}\n\n`);

    for await (const chunk of aiResponse.body as any) {
      const text = decoder.decode(chunk);
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
        } catch {}
      }
    }

    reply.write(`data: ${JSON.stringify({ chunk: '', done: true, fullAnswer })}\n\n`);
    reply.end();

    await this.incrementUsage(userId);
  }

  private async checkUsageLimit(userId: string): Promise<void> {
    const sql = getDB();
    const [usage] = await sql`
      SELECT u.is_pro, uu.sessions_used, uu.responses_used
      FROM users u
      LEFT JOIN user_usage uu ON uu.user_id = u.id
      WHERE u.id = ${userId}
    `;
    if (usage?.is_pro) return;
    if ((usage?.responses_used || 0) >= 10) {
      throw new ForbiddenException('Free tier limit reached');
    }
  }

  private async incrementUsage(userId: string): Promise<void> {
    const sql = getDB();
    await sql`
      UPDATE user_usage
      SET responses_used = responses_used + 1
      WHERE user_id = ${userId}
    `;
  }
}
```
