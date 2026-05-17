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
