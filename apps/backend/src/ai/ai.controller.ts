import { Controller, Post, Body, Res, Req, Headers, UseGuards, HttpCode, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AiService, ScorerReport } from './ai.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { DeviceService } from '../device/device.service';
import { QuotaService } from '../quota/quota.service';
import { getDB } from '../database/db';
import { getRedis } from '../redis/redis';

function logSession(userId: string, type: 'stream' | 'screenshot' | 'transcribe'): void {
  getDB()
    .query('INSERT INTO ai_sessions (user_id, type) VALUES ($1, $2)', [userId, type])
    .catch((err: unknown) => {
      console.error('[AiController] session log failed:', (err as Error).message);
    });
}

function sanitize(s: string): string {
  return s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
}

const SSE_ORIGIN = process.env.ELECTRON_ORIGIN ?? 'app://zoomguru';

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache',
  'Connection': 'keep-alive',
  'Access-Control-Allow-Origin': SSE_ORIGIN,
} as const;

const RATE_LIMIT = 15;
const WINDOW_SEC = 60;
const SESSION_CAP_MONTHLY = 50;

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string };
}

async function checkSessionCap(
  userId: string,
  plan: string | null,
): Promise<{ capped: boolean }> {
  if (plan !== 'monthly') return { capped: false };
  const redis = getRedis();
  // Key resets at midnight UTC by using the current UTC date.
  const date = new Date().toISOString().slice(0, 10);
  const key = `cap:${userId}:${date}`;
  const [[, count]] = (await redis
    .pipeline()
    .incr(key)
    // TTL of 25h so the key is definitely gone before the next day's key matters.
    .expire(key, 90_000)
    .exec()) as [[null, number], [null, number]];
  return { capped: count > SESSION_CAP_MONTHLY };
}

async function checkRateLimit(userId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = getRedis();
  const key = `rl:${userId}`;
  // Pipeline sends INCR + EXPIRE in one round trip and always sets the TTL,
  // so a crashed process that skipped EXPIRE can never leave a keyless entry.
  const [[, count], , [, ttlAfter]] = (await redis
    .pipeline()
    .incr(key)
    .expire(key, WINDOW_SEC)
    .ttl(key)
    .exec()) as [[null, number], [null, number], [null, number]];
  if (count > RATE_LIMIT) {
    return { allowed: false, retryAfter: ttlAfter > 0 ? ttlAfter : WINDOW_SEC };
  }
  return { allowed: true, retryAfter: 0 };
}

@Controller('ai')
export class AiController {
  constructor(
    private aiService: AiService,
    private subscriptionService: SubscriptionService,
    private deviceService: DeviceService,
    private quotaService: QuotaService,
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

    // A2-4: checkRateLimit wrapped in try-catch — Redis crash fails open
    let rateLimitResult: { allowed: boolean; retryAfter: number } = { allowed: true, retryAfter: 0 };
    try {
      rateLimitResult = await checkRateLimit(req.user.userId);
    } catch (err) {
      console.warn('Redis unavailable — rate limit skipped:', err);
    }

    const [sigResult, { canUse, deviceAllowed, plan }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) {
      await reply.code(403).send({ error: sigResult.reason });
      return;
    }
    if (!canUse) {
      await reply.code(403).send({ error: 'subscription_required' });
      return;
    }
    if (!deviceAllowed) {
      await reply.code(403).send({ error: 'device_locked' });
      return;
    }
    if (!rateLimitResult.allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter });
      return;
    }

    // A2-4: checkSessionCap wrapped in try-catch — Redis crash fails open
    let sessionCapResult: { capped: boolean } = { capped: false };
    try {
      sessionCapResult = await checkSessionCap(req.user.userId, plan);
    } catch (err) {
      console.warn('Redis unavailable — session cap skipped:', err);
    }
    if (sessionCapResult.capped) {
      await reply.code(429).send({ error: 'session_cap' });
      return;
    }

    const planInfo = await this.quotaService.getPlanType(req.user.userId);
    if (planInfo) {
      const quota = await this.quotaService.checkQuota(
        req.user.userId, 'copilot_requests', planInfo.planType, planInfo.periodStart,
      );
      if (!quota.allowed) {
        await reply.code(429).send({
          error: 'quota_exceeded',
          feature: quota.feature,
          planType: quota.planType,
          limit: quota.limit,
          used: quota.used,
          resetAt: quota.resetAt,
          upgradeCta: 'Upgrade your plan at https://zoomguru.xyz/#pricing',
        });
        return;
      }
    }
    logSession(req.user.userId, 'stream');
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

    // A2-4: checkRateLimit wrapped in try-catch — Redis crash fails open
    let rateLimitResult: { allowed: boolean; retryAfter: number } = { allowed: true, retryAfter: 0 };
    try {
      rateLimitResult = await checkRateLimit(req.user.userId);
    } catch (err) {
      console.warn('Redis unavailable — rate limit skipped:', err);
    }

    const [sigResult, { canUse, deviceAllowed, plan }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) {
      await reply.code(403).send({ error: sigResult.reason });
      return;
    }
    if (!canUse) {
      await reply.code(403).send({ error: 'subscription_required' });
      return;
    }
    if (!deviceAllowed) {
      await reply.code(403).send({ error: 'device_locked' });
      return;
    }
    if (!rateLimitResult.allowed) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter });
      return;
    }

    // A2-4: checkSessionCap wrapped in try-catch — Redis crash fails open
    let sessionCapResult: { capped: boolean } = { capped: false };
    try {
      sessionCapResult = await checkSessionCap(req.user.userId, plan);
    } catch (err) {
      console.warn('Redis unavailable — session cap skipped:', err);
    }
    if (sessionCapResult.capped) {
      await reply.code(429).send({ error: 'session_cap' });
      return;
    }

    const planInfo = await this.quotaService.getPlanType(req.user.userId);
    if (planInfo) {
      const quota = await this.quotaService.checkQuota(
        req.user.userId, 'copilot_requests', planInfo.planType, planInfo.periodStart,
      );
      if (!quota.allowed) {
        await reply.code(429).send({
          error: 'quota_exceeded',
          feature: quota.feature,
          planType: quota.planType,
          limit: quota.limit,
          used: quota.used,
          resetAt: quota.resetAt,
          upgradeCta: 'Upgrade your plan at https://zoomguru.xyz/#pricing',
        });
        return;
      }
    }
    logSession(req.user.userId, 'screenshot');
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
  @Post('interviewer-start')
  async interviewerStart(
    @Req() req: AuthenticatedRequest,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<{ quotaUsed: number; quotaLimit: number; resetAt: string }> {
    const [sigResult, { canUse, deviceAllowed }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) throw new HttpException({ error: sigResult.reason }, HttpStatus.FORBIDDEN);
    if (!canUse) throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);
    if (!deviceAllowed) throw new HttpException({ error: 'device_locked' }, HttpStatus.FORBIDDEN);

    const planInfo = await this.quotaService.getPlanType(req.user.userId);
    if (!planInfo) throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);

    const quota = await this.quotaService.checkQuota(
      req.user.userId, 'interviewer_sessions', planInfo.planType, planInfo.periodStart,
    );
    if (!quota.allowed) {
      throw new HttpException({
        error: 'quota_exceeded',
        feature: quota.feature,
        planType: quota.planType,
        limit: quota.limit,
        used: quota.used,
        resetAt: quota.resetAt,
        upgradeCta: 'Upgrade your plan at https://zoomguru.xyz/#pricing',
      }, 429);
    }
    return { quotaUsed: quota.used, quotaLimit: quota.limit, resetAt: quota.resetAt };
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('interviewer-question')
  async interviewerQuestion(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      cvText?: string;
      jdText?: string;
      difficulty: 'easy' | 'medium' | 'hard' | 'dynamic';
      questionNumber: number;
      priorQuestions: string[];
      lastAnswerQuality?: 'good' | 'average' | 'poor';
    },
    @Res() reply: FastifyReply,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<void> {
    const difficulty = body.difficulty;
    if (!['easy', 'medium', 'hard', 'dynamic'].includes(difficulty)) {
      throw new BadRequestException('Invalid difficulty');
    }
    const qNum = Number(body.questionNumber);
    if (!Number.isInteger(qNum) || qNum < 1 || qNum > 100) {
      throw new BadRequestException('Invalid question number');
    }
    const priorQuestions = Array.isArray(body.priorQuestions)
      ? body.priorQuestions.slice(0, 30).map((q) => sanitize(String(q).slice(0, 500)))
      : [];

    // A2-4: checkRateLimit wrapped in try-catch — Redis crash fails open
    let rateLimitResult: { allowed: boolean; retryAfter: number } = { allowed: true, retryAfter: 0 };
    try {
      rateLimitResult = await checkRateLimit(req.user.userId);
    } catch (err) {
      console.warn('Redis unavailable — rate limit skipped:', err);
    }

    const [sigResult, { canUse, deviceAllowed }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse) { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (!deviceAllowed) { await reply.code(403).send({ error: 'device_locked' }); return; }
    if (!rateLimitResult.allowed) { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.generateInterviewerQuestion({
      cvText: body.cvText ? sanitize(body.cvText) : undefined,
      jdText: body.jdText ? sanitize(body.jdText) : undefined,
      difficulty,
      questionNumber: qNum,
      priorQuestions,
      lastAnswerQuality: body.lastAnswerQuality,
      reply: reply.raw,
    });
  }

  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @Post('score-session')
  async scoreSession(
    @Req() req: AuthenticatedRequest,
    @Body() body: { entries: Array<{ question: string; answer: string }> },
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<ScorerReport> {
    if (
      !Array.isArray(body.entries) ||
      body.entries.length === 0 ||
      body.entries.length > 30
    ) {
      throw new BadRequestException('Invalid entries');
    }

    // A2-5: score-session now enforces rate limit (fail-open on Redis error)
    try {
      const { allowed, retryAfter } = await checkRateLimit(req.user.userId);
      if (!allowed) {
        throw new HttpException({ error: 'rate_limit', retryAfter }, 429);
      }
    } catch (err) {
      if (err instanceof HttpException) throw err;
      console.warn('Redis unavailable — rate limit skipped:', err);
    }

    const [sigResult, { canUse, deviceAllowed }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) throw new HttpException({ error: sigResult.reason }, HttpStatus.FORBIDDEN);
    if (!canUse) throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);
    if (!deviceAllowed) throw new HttpException({ error: 'device_locked' }, HttpStatus.FORBIDDEN);

    const planInfo = await this.quotaService.getPlanType(req.user.userId);
    if (planInfo) {
      const quota = await this.quotaService.checkQuota(
        req.user.userId, 'scorer_reports', planInfo.planType, planInfo.periodStart,
      );
      if (!quota.allowed) {
        throw new HttpException({
          error: 'quota_exceeded',
          feature: quota.feature,
          limit: quota.limit,
          used: quota.used,
          resetAt: quota.resetAt,
          upgradeCta: 'Upgrade your plan to unlock more feedback reports.',
        }, 429);
      }
    }

    const cleanEntries = body.entries.slice(0, 30).map((e) => ({
      question: sanitize(String(e.question ?? '').slice(0, 500)),
      answer: sanitize(String(e.answer ?? '').slice(0, 1000)),
    }));

    return this.aiService.scoreSession(cleanEntries);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('doc-copilot')
  async docCopilot(
    @Req() req: AuthenticatedRequest,
    @Body() body: {
      transcript: string;
      documents: Array<{ docId: string; fileName: string; serializedContent: string }>;
      cacheKey?: string;
    },
    @Res() reply: FastifyReply,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<void> {
    if (!body.transcript || body.transcript.length > 4000) {
      throw new BadRequestException('Invalid transcript');
    }
    if (!Array.isArray(body.documents) || body.documents.length === 0 || body.documents.length > 3) {
      throw new BadRequestException('documents must be an array of 1–3 items');
    }

    // A2-4: checkRateLimit wrapped in try-catch — Redis crash fails open
    let rateLimitResult: { allowed: boolean; retryAfter: number } = { allowed: true, retryAfter: 0 };
    try {
      rateLimitResult = await checkRateLimit(req.user.userId);
    } catch (err) {
      console.warn('Redis unavailable — rate limit skipped:', err);
    }

    const [sigResult, { canUse, deviceAllowed }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)   { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (!deviceAllowed) { await reply.code(403).send({ error: 'device_locked' }); return; }
    if (!rateLimitResult.allowed)  { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    const planInfo = await this.quotaService.getPlanType(req.user.userId);
    if (planInfo) {
      const quota = await this.quotaService.checkQuota(
        req.user.userId, 'doc_copilot_requests', planInfo.planType, planInfo.periodStart,
      );
      if (!quota.allowed) {
        await reply.code(429).send({
          error: 'quota_exceeded',
          feature: quota.feature,
          limit: quota.limit,
          used: quota.used,
          resetAt: quota.resetAt,
        });
        return;
      }
    }

    const cleanDocs = body.documents.slice(0, 3).map((d) => ({
      docId:             sanitize(String(d.docId   ?? '').slice(0, 64)),
      fileName:          sanitize(String(d.fileName ?? '').slice(0, 256)),
      serializedContent: sanitize(String(d.serializedContent ?? '').slice(0, 200_000)),
    }));

    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamDocCopilot({
      transcript: sanitize(body.transcript),
      documents:  cleanDocs,
      cacheKey:   body.cacheKey ? sanitize(body.cacheKey.slice(0, 128)) : undefined,
      reply:      reply.raw,
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

    // A2-4: checkRateLimit wrapped in try-catch — Redis crash fails open
    let rateLimitResult: { allowed: boolean; retryAfter: number } = { allowed: true, retryAfter: 0 };
    try {
      rateLimitResult = await checkRateLimit(req.user.userId);
    } catch (err) {
      console.warn('Redis unavailable — rate limit skipped:', err);
    }

    const [sigResult, { canUse, deviceAllowed }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId, keyId),
    ]);
    if (!sigResult.valid) {
      throw new HttpException({ error: sigResult.reason }, HttpStatus.FORBIDDEN);
    }
    if (!canUse) {
      throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);
    }
    if (!deviceAllowed) {
      throw new HttpException({ error: 'device_locked' }, HttpStatus.FORBIDDEN);
    }
    if (!rateLimitResult.allowed) {
      throw new HttpException({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }, 429);
    }
    logSession(req.user.userId, 'transcribe');
    const cleanAudio = sanitize(body.audio);
    const transcript = await this.aiService.transcribe({ audio: cleanAudio });
    return { transcript };
  }
}
