import { Controller, Post, Body, Res, Req, Headers, UseGuards, HttpCode, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AiService } from './ai.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { DeviceService } from '../device/device.service';
import { getDB } from '../database/db';
import { getRedis } from '../redis/redis';

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': '*',
} as const;

const RATE_LIMIT = 15;
const WINDOW_SEC = 60;

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string };
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = getRedis();
  const key = `rl:${userId}`;
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, WINDOW_SEC);
  }
  if (count > RATE_LIMIT) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl > 0 ? ttl : WINDOW_SEC };
  }
  return { allowed: true, retryAfter: 0 };
}

@Controller('ai')
export class AiController {
  constructor(
    private aiService: AiService,
    private subscriptionService: SubscriptionService,
    private deviceService: DeviceService,
  ) {}

  @UseGuards(AuthGuard('jwt'))
  @Post('stream')
  async stream(
    @Req() req: AuthenticatedRequest,
    @Body() body: { transcript: string; sessionId?: string; cvText?: string; jdText?: string },
    @Res() reply: FastifyReply,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<void> {
    if (!body.transcript || body.transcript.length > 4000) {
      throw new BadRequestException('Invalid transcript');
    }
    const sigValid = await this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature);
    if (!sigValid) {
      await reply.code(403).send({ error: 'invalid_signature' });
      return;
    }
    const canUse = await this.subscriptionService.canUseAI(req.user.userId);
    if (!canUse) {
      await reply.code(403).send({ error: 'subscription_required' });
      return;
    }
    const deviceAllowed = await this.subscriptionService.checkDevice(req.user.userId, keyId);
    if (!deviceAllowed) {
      await reply.code(403).send({ error: 'device_locked' });
      return;
    }
    const { allowed, retryAfter } = await checkRateLimit(req.user.userId);
    if (!allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter });
      return;
    }
    void getDB().query(
      'INSERT INTO ai_sessions (user_id, type) VALUES ($1, $2)',
      [req.user.userId, 'stream'],
    );
    const cleanTranscript = sanitize(body.transcript);
    const cleanCv         = body.cvText ? sanitize(body.cvText) : undefined;
    const cleanJd         = body.jdText ? sanitize(body.jdText) : undefined;
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamAnswer({
      transcript: cleanTranscript,
      reply: reply.raw,
      cvText: cleanCv,
      jdText: cleanJd,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('screenshot')
  async screenshot(
    @Req() req: AuthenticatedRequest,
    @Body() body: { image: string; sessionId?: string; cvText?: string; jdText?: string; priorContext?: string[] },
    @Res() reply: FastifyReply,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<void> {
    if (!body.image || body.image.length > 10_000_000) {
      throw new BadRequestException('Invalid image');
    }
    const sigValid = await this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature);
    if (!sigValid) {
      await reply.code(403).send({ error: 'invalid_signature' });
      return;
    }
    const canUse = await this.subscriptionService.canUseAI(req.user.userId);
    if (!canUse) {
      await reply.code(403).send({ error: 'subscription_required' });
      return;
    }
    const deviceAllowed = await this.subscriptionService.checkDevice(req.user.userId, keyId);
    if (!deviceAllowed) {
      await reply.code(403).send({ error: 'device_locked' });
      return;
    }
    const { allowed, retryAfter } = await checkRateLimit(req.user.userId);
    if (!allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter });
      return;
    }
    void getDB().query(
      'INSERT INTO ai_sessions (user_id, type) VALUES ($1, $2)',
      [req.user.userId, 'screenshot'],
    );
    const cleanImage = sanitize(body.image);
    const cleanCv    = body.cvText ? sanitize(body.cvText) : undefined;
    const cleanJd    = body.jdText ? sanitize(body.jdText) : undefined;
    const cleanPriorContext = Array.isArray(body.priorContext)
      ? body.priorContext
          .slice(0, 5)
          .map((s) => (typeof s === 'string' ? sanitize(s.slice(0, 300)) : ''))
          .filter(Boolean)
      : undefined;
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamScreenshot({
      image: cleanImage,
      reply: reply.raw,
      cvText: cleanCv,
      jdText: cleanJd,
      priorContext: cleanPriorContext,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @Post('transcribe')
  async transcribe(
    @Req() req: AuthenticatedRequest,
    @Body() body: { audio: string },
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<{ transcript: string }> {
    if (!body.audio || body.audio.length > 5_000_000) {
      throw new BadRequestException('Invalid audio');
    }
    const sigValid = await this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature);
    if (!sigValid) {
      throw new HttpException({ error: 'invalid_signature' }, HttpStatus.FORBIDDEN);
    }
    const canUse = await this.subscriptionService.canUseAI(req.user.userId);
    if (!canUse) {
      throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);
    }
    const deviceAllowed = await this.subscriptionService.checkDevice(req.user.userId, keyId);
    if (!deviceAllowed) {
      throw new HttpException({ error: 'device_locked' }, HttpStatus.FORBIDDEN);
    }
    const { allowed, retryAfter } = await checkRateLimit(req.user.userId);
    if (!allowed) {
      throw new HttpException({ error: 'rate_limit', retryAfter }, 429);
    }
    void getDB().query(
      'INSERT INTO ai_sessions (user_id, type) VALUES ($1, $2)',
      [req.user.userId, 'transcribe'],
    );
    const cleanAudio = sanitize(body.audio);
    const transcript = await this.aiService.transcribe({ audio: cleanAudio });
    return { transcript };
  }
}
