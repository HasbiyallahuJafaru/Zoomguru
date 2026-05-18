import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class SessionService {

  async getHistory(userId: string) {
    const sql = getDB();
    const sessions = await sql`
      SELECT
        id,
        interview_type,
        job_description,
        answer_length,
        total_questions,
        started_at,
        ended_at,
        jsonb_array_length(messages) as message_count
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
        job_description,
        answer_length,
        messages,
        total_questions,
        started_at,
        ended_at,
        cv_profile
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
    const messages = session.messages || [];

    const lines: string[] = [
      `ZoomGuru Interview Transcript`,
      `Session ID: ${session.id}`,
      `Type: ${session.interview_type}`,
      `Date: ${new Date(session.started_at).toLocaleString()}`,
      `Total Questions: ${session.total_questions}`,
      `---`,
      '',
    ];

    for (const msg of messages) {
      const role = msg.role === 'user' ? 'INTERVIEWER' : 'YOU';
      const time = msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString() : '';
      lines.push(`[${time}] ${role}:`);
      lines.push(msg.content);
      lines.push('');
    }

    return lines.join('\n');
  }
}
