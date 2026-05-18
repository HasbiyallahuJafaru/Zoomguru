import { Injectable, NotFoundException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class SessionService {

  async getHistory(userId: string) {
    const sql = getDB();
    const sessions = await sql`
      SELECT
        id,
        interview_type,
        answer_length,
        summary,
        total_questions,
        duration_seconds,
        started_at,
        ended_at
      FROM interview_sessions
      WHERE user_id = ${userId}
      ORDER BY started_at DESC
      LIMIT 20
    `;
    return sessions;
  }

  async getSession(userId: string, sessionId: string) {
    const sql = getDB();
    const [session] = await sql`
      SELECT
        id,
        interview_type,
        answer_length,
        summary,
        total_questions,
        duration_seconds,
        started_at,
        ended_at
      FROM interview_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    return session;
  }

  async endSession(params: {
    userId: string;
    sessionId: string;
    messages: Array<{ role: string; content: string }>;
    durationSeconds: number;
    totalQuestions: number;
  }): Promise<void> {
    const sql = getDB();

    let summary = 'Session completed.';

    if (params.messages.length > 0) {
      const transcript = params.messages
        .map(m => `${m.role === 'user' ? 'Q' : 'A'}: ${m.content}`)
        .join('\n\n')
        .slice(0, 6000);

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

  async deleteSession(userId: string, sessionId: string) {
    const sql = getDB();

    const [session] = await sql`
      SELECT id FROM interview_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    if (!session) {
      throw new NotFoundException('Session not found');
    }

    await sql`
      DELETE FROM interview_sessions
      WHERE id = ${sessionId} AND user_id = ${userId}
    `;

    return { success: true };
  }

  async exportTranscript(userId: string, sessionId: string): Promise<string> {
    const session = await this.getSession(userId, sessionId);

    const lines: string[] = [
      `ZoomGuru Interview Session Summary`,
      `Session ID: ${session.id}`,
      `Type: ${session.interview_type}`,
      `Date: ${new Date(session.started_at).toLocaleString()}`,
      `Duration: ${session.duration_seconds ? Math.round(session.duration_seconds / 60) + ' minutes' : 'N/A'}`,
      `Total Questions: ${session.total_questions}`,
      `---`,
      '',
      session.summary || 'No summary available.',
      '',
    ];

    return lines.join('\n');
  }
}
