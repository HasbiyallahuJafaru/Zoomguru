import { Controller, Post, Body, Res, UseGuards, Req } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceGuard } from '../guards/device.guard';
import { AiService } from './ai.service';

@Controller('ai')
@UseGuards(JwtAuthGuard, DeviceGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('stream')
  async streamAnswer(
    @Body() body: { sessionId: string; transcript: string },
    @Req() req: any,
    @Res() reply: FastifyReply
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      await this.aiService.streamAnswer({
        userId: req.user.userId,
        sessionId: body.sessionId,
        transcript: body.transcript,
        reply: reply.raw,
      });
    } catch (err: any) {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        reply.raw.end();
      }
    }
  }

  @Post('screenshot')
  async streamScreenshot(
    @Body() body: { sessionId: string; image: string; voiceContext?: string },
    @Req() req: any,
    @Res() reply: FastifyReply
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      await this.aiService.streamScreenshot({
        userId: req.user.userId,
        sessionId: body.sessionId,
        image: body.image,
        voiceContext: body.voiceContext,
        reply: reply.raw,
      });
    } catch (err: any) {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        reply.raw.end();
      }
    }
  }

  @Post('session/start')
  async startSession(
    @Req() req: any,
    @Body() body: {
      jobDescription?: string;
      interviewType?: string;
      answerLength?: string;
    }
  ) {
    const sql = (await import('../database/db')).getDB();
    const userId = req.user.userId;

    // Load user's CV profile
    const [cvRow] = await sql`
      SELECT parsed_profile FROM cv_profiles WHERE user_id = ${userId}
    `;

    const [session] = await sql`
      INSERT INTO interview_sessions (
        user_id, cv_profile, job_description, interview_type, answer_length
      )
      VALUES (
        ${userId},
        ${cvRow ? JSON.stringify(cvRow.parsed_profile) : null},
        ${body.jobDescription || null},
        ${body.interviewType || 'general'},
        ${body.answerLength || 'standard'}
      )
      RETURNING id, started_at
    `;

    // Increment sessions used
    await sql`
      INSERT INTO user_usage (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO UPDATE
      SET sessions_used = user_usage.sessions_used + 1,
          last_session_at = NOW()
    `;

    return { sessionId: session.id, startedAt: session.started_at };
  }

  @Post('session/end')
  async endSession(
    @Req() req: any,
    @Body() body: { sessionId: string }
  ) {
    const sql = (await import('../database/db')).getDB();

    await sql`
      UPDATE interview_sessions
      SET ended_at = NOW()
      WHERE id = ${body.sessionId} AND user_id = ${req.user.userId}
    `;

    return { success: true };
  }
}
