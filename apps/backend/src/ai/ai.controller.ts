import { Controller, Post, Body, Res, UseGuards, Req, ForbiddenException } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DeviceGuard } from '../guards/device.guard';
import { AiService } from './ai.service';
import { sseManager } from './sse-manager';
import { getDB } from '../database/db';

const ALLOWED_SSE_ORIGINS = new Set([
  'https://zoomguru.xyz',
  'app://.',
  'http://localhost:5173',
  'http://localhost:3000',
  'http://localhost:3001',
]);

function sseOrigin(req: any): string {
  const origin: string = req.headers?.origin || '';
  if (
    ALLOWED_SSE_ORIGINS.has(origin) ||
    /^https:\/\/zoomguru(-[a-z0-9]+)?\.vercel\.app$/.test(origin)
  ) {
    return origin;
  }
  return 'null';
}

@Controller('ai')
@UseGuards(JwtAuthGuard, DeviceGuard)
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('stream')
  async streamAnswer(
    @Body() body: { sessionId: string; transcript: string; mode?: string },
    @Req() req: any,
    @Res() reply: FastifyReply
  ) {
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': sseOrigin(req),
    });
    sseManager.add(req.user.userId, reply.raw);

    try {
      await this.aiService.streamAnswer({
        userId: req.user.userId,
        sessionId: body.sessionId,
        transcript: body.transcript,
        mode: body.mode,
        reply: reply.raw,
      });
    } catch (err: any) {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        reply.raw.end();
      }
    } finally {
      sseManager.remove(req.user.userId);
    }
  }

  @Post('screenshot')
  async streamScreenshot(
    @Body() body: { sessionId: string; image: string; voiceContext?: string; mode?: string },
    @Req() req: any,
    @Res() reply: FastifyReply
  ) {
    // Reject oversized payloads before starting SSE (10 MB base64 ≈ 7.5 MB image)
    const MAX_IMAGE_B64 = 10 * 1024 * 1024;
    if (!body.image || body.image.length > MAX_IMAGE_B64) {
      return reply.status(400).send({ error: 'Image missing or too large (max 10 MB)' });
    }
    // Strip optional data-URL prefix and validate MIME type
    const dataUrlMatch = body.image.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,/);
    const imageData = dataUrlMatch
      ? body.image.slice(dataUrlMatch[0].length)
      : body.image;
    // Sniff magic bytes to confirm image type (base64 decode first 8 bytes)
    const magic = Buffer.from(imageData.slice(0, 12), 'base64');
    const isPng  = magic[0] === 0x89 && magic[1] === 0x50;
    const isJpeg = magic[0] === 0xff && magic[1] === 0xd8;
    const isWebp = magic[8] === 0x57 && magic[9] === 0x45 && magic[10] === 0x42 && magic[11] === 0x50;
    const isGif  = magic[0] === 0x47 && magic[1] === 0x49;
    if (!isPng && !isJpeg && !isWebp && !isGif) {
      return reply.status(400).send({ error: 'Image must be PNG, JPEG, WebP, or GIF' });
    }

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': sseOrigin(req),
    });
    sseManager.add(req.user.userId, reply.raw);

    try {
      await this.aiService.streamScreenshot({
        userId: req.user.userId,
        sessionId: body.sessionId,
        image: imageData,
        voiceContext: body.voiceContext,
        mode: body.mode,
        reply: reply.raw,
      });
    } catch (err: any) {
      if (!reply.raw.writableEnded) {
        reply.raw.write(`data: ${JSON.stringify({ error: err.message, done: true })}\n\n`);
        reply.raw.end();
      }
    } finally {
      sseManager.remove(req.user.userId);
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
    const sql = getDB();
    const userId = req.user.userId;

    // Enforce free-tier session cap before creating a new session
    const [userUsage] = await sql`
      SELECT u.is_pro, uu.sessions_used
      FROM users u
      LEFT JOIN user_usage uu ON uu.user_id = u.id
      WHERE u.id = ${userId}
    `;
    if (userUsage && !userUsage.is_pro && (userUsage.sessions_used || 0) >= 3) {
      throw new ForbiddenException('Free tier limit reached: 3 sessions used. Upgrade to continue.');
    }

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

    // Increment sessions used and reset per-session response counter
    await sql`
      INSERT INTO user_usage (user_id)
      VALUES (${userId})
      ON CONFLICT (user_id) DO UPDATE
      SET sessions_used = user_usage.sessions_used + 1,
          responses_used = 0,
          last_session_at = NOW()
    `;

    return { sessionId: session.id, startedAt: session.started_at };
  }

  // Session end is handled by POST /session/end (SessionController → SessionService)
  // which saves messages, duration, totalQuestions, and generates an AI summary.
  // This route intentionally removed to prevent the bare ended_at-only version from
  // shadowing the correct endpoint and silently discarding all session data.
}
