import { Controller, Post, Body, Res, Req, Headers, UseGuards, HttpCode, HttpException, HttpStatus, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { FastifyReply, FastifyRequest } from 'fastify';
import { AiService, ScorerReport } from './ai.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { DeviceService } from '../device/device.service';
import { QuotaService } from '../quota/quota.service';
import { getRedis } from '../redis/redis';

function logSession(userId: string, type: 'stream' | 'screenshot' | 'transcribe' | 'meeting' | 'interviewer' | 'doc_copilot' | 'tts'): void {
  getRedis()
    .lpush('session_log_queue', JSON.stringify({ userId, type, ts: Date.now() }))
    .catch((err: unknown) => {
      console.error('[AiController] session log enqueue failed:', (err as Error).message);
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

// Per-user AI rate limit over a rolling 60s window. Active subscribers get a
// much higher ceiling than trial/inactive users because a live interview in auto
// mode spends ~2 requests per question (transcribe + stream) plus screenshots.
const RATE_LIMIT_ACTIVE = 40;
const RATE_LIMIT_TRIAL = 15;
const WINDOW_SEC = 60;
// Daily AI request cap (monthly plan only). Raised in step with the per-minute
// rate limit so a paying monthly subscriber isn't throttled after a couple of
// minutes of heavy use during a live interview.
const SESSION_CAP_DAILY = 150;

function rateLimitExceeded(count: number, subActive: boolean): boolean {
  return count > (subActive ? RATE_LIMIT_ACTIVE : RATE_LIMIT_TRIAL);
}

interface AuthenticatedRequest extends FastifyRequest {
  user: { userId: string; email: string };
}

function sessionCapKey(userId: string, periodStart: Date | null): string {
  if (periodStart) {
    const daysElapsed = Math.floor((Date.now() - periodStart.getTime()) / 86_400_000);
    return `cap:${userId}:${daysElapsed}`;
  }
  return `cap:${userId}:${new Date().toISOString().slice(0, 10)}`;
}

// Read current count without incrementing — used in the gate check.
async function peekSessionCap(
  userId: string,
  plan: string | null,
  periodStart: Date | null,
): Promise<{ capped: boolean }> {
  if (plan !== 'monthly') return { capped: false };
  const redis = getRedis();
  const raw = await redis.get(sessionCapKey(userId, periodStart));
  const count = raw ? Number(raw) : 0;
  return { capped: count >= SESSION_CAP_DAILY };
}

// Increment the counter — called only after the stream is committed.
// Fails open so a Redis outage never blocks the user.
function consumeSessionCap(userId: string, plan: string | null, periodStart: Date | null): void {
  if (plan !== 'monthly') return;
  const redis = getRedis();
  const key = sessionCapKey(userId, periodStart);
  // TTL of 25h so the key is gone well before the next window's key matters.
  redis.pipeline().incr(key).expire(key, 90_000).exec().catch(() => undefined);
}

// Increments the per-user counter and returns the current count + TTL. The
// allow/deny decision is made by the caller via rateLimitExceeded(), since the
// ceiling depends on the user's subscription tier (known from checkAccess).
async function checkRateLimit(userId: string): Promise<{ count: number; retryAfter: number }> {
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
  return { count, retryAfter: ttlAfter > 0 ? ttlAfter : WINDOW_SEC };
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

    // Run rate limit + auth checks in parallel (saves one serial Redis round trip)
    const [rateLimitResult, [sigResult, { canUse, plan, periodStart, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);

    if (!sigResult.valid) { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)          { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (rateLimitExceeded(rateLimitResult.count, subActive)) {
      await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter });
      return;
    }

    // Session cap is checked BEFORE quota, not alongside it: checkQuota spends a
    // quota unit as part of asking, so running the two in parallel billed every
    // request the cap then refused. Serial costs one Redis GET.
    const sessionCapResult = await peekSessionCap(req.user.userId, plan, periodStart).catch(() => ({ capped: false }));
    if (sessionCapResult.capped) { await reply.code(429).send({ error: 'session_cap' }); return; }

    const validPlan = plan && periodStart && ['weekly', 'monthly', 'yearly'].includes(plan) ? plan as import('../quota/quota.service').PlanType : null;
    const quota = validPlan && periodStart
      ? await this.quotaService.checkQuota(req.user.userId, 'copilot_requests', validPlan, periodStart).catch(() => null)
      : null;

    if (quota && !quota.allowed) {
      await reply.code(429).send({
        error: 'quota_exceeded', feature: quota.feature, planType: quota.planType,
        limit: quota.limit, used: quota.used, resetAt: quota.resetAt,
        upgradeCta: 'Upgrade your plan at https://zoomguru.xyz/#pricing',
      });
      return;
    }

    logSession(req.user.userId, 'stream');
    const ac = new AbortController();
    reply.raw.on('close', () => ac.abort());
    consumeSessionCap(req.user.userId, plan, periodStart);
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamAnswer({
      transcript: sanitize(body.transcript),
      reply: reply.raw,
      cvText: body.cvText ? sanitize(body.cvText) : undefined,
      jdText: body.jdText ? sanitize(body.jdText) : undefined,
      signal: ac.signal,
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
    if (!/^[A-Za-z0-9+/=]+$/.test(body.image)) {
      throw new BadRequestException('Invalid image encoding');
    }

    const [rateLimitResult, [sigResult, { canUse, plan, periodStart, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);

    if (!sigResult.valid)         { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)                  { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (rateLimitExceeded(rateLimitResult.count, subActive)) { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    // Cap before quota — see the note in stream() above.
    const sessionCapResult = await peekSessionCap(req.user.userId, plan, periodStart).catch(() => ({ capped: false }));
    if (sessionCapResult.capped) { await reply.code(429).send({ error: 'session_cap' }); return; }

    const validPlan = plan && periodStart && ['weekly', 'monthly', 'yearly'].includes(plan) ? plan as import('../quota/quota.service').PlanType : null;
    const quota = validPlan && periodStart
      ? await this.quotaService.checkQuota(req.user.userId, 'copilot_requests', validPlan, periodStart).catch(() => null)
      : null;

    if (quota && !quota.allowed) {
      await reply.code(429).send({
        error: 'quota_exceeded', feature: quota.feature, planType: quota.planType,
        limit: quota.limit, used: quota.used, resetAt: quota.resetAt,
        upgradeCta: 'Upgrade your plan at https://zoomguru.xyz/#pricing',
      });
      return;
    }

    logSession(req.user.userId, 'screenshot');
    const cleanPriorContext = Array.isArray(body.priorContext)
      ? body.priorContext.slice(0, 5).map((s) => (typeof s === 'string' ? sanitize(s.slice(0, 300)) : '')).filter(Boolean)
      : undefined;
    const ac = new AbortController();
    reply.raw.on('close', () => ac.abort());
    consumeSessionCap(req.user.userId, plan, periodStart);
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamScreenshot({
      image: body.image,
      reply: reply.raw,
      cvText: body.cvText ? sanitize(body.cvText) : undefined,
      jdText: body.jdText ? sanitize(body.jdText) : undefined,
      priorContext: cleanPriorContext,
      signal: ac.signal,
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
    const [sigResult, { canUse, plan, periodStart }] = await Promise.all([
      this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
      this.subscriptionService.checkAccess(req.user.userId),
    ]);
    if (!sigResult.valid) throw new HttpException({ error: sigResult.reason }, HttpStatus.FORBIDDEN);
    if (!canUse) throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);

    const validPlan = plan && periodStart && ['weekly', 'monthly', 'yearly'].includes(plan) ? plan as import('../quota/quota.service').PlanType : null;
    if (!validPlan || !periodStart) {
      return { quotaUsed: 0, quotaLimit: 0, resetAt: '' };
    }

    const quota = await this.quotaService.checkQuota(
      req.user.userId, 'interviewer_sessions', validPlan, periodStart,
    );
    if (!quota.allowed) {
      throw new HttpException({
        error: 'quota_exceeded', feature: quota.feature, planType: quota.planType,
        limit: quota.limit, used: quota.used, resetAt: quota.resetAt,
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

    const [rateLimitResult, [sigResult, { canUse, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);
    if (!sigResult.valid)         { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)                  { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (rateLimitExceeded(rateLimitResult.count, subActive)) { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    logSession(req.user.userId, 'interviewer');
    const ac = new AbortController();
    reply.raw.on('close', () => ac.abort());
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.generateInterviewerQuestion({
      cvText: body.cvText ? sanitize(body.cvText) : undefined,
      jdText: body.jdText ? sanitize(body.jdText) : undefined,
      difficulty,
      questionNumber: qNum,
      priorQuestions,
      lastAnswerQuality: body.lastAnswerQuality,
      reply: reply.raw,
      signal: ac.signal,
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

    const [rateLimitResult, [sigResult, { canUse, plan, periodStart, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);
    if (rateLimitExceeded(rateLimitResult.count, subActive)) throw new HttpException({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }, 429);
    if (!sigResult.valid) throw new HttpException({ error: sigResult.reason }, HttpStatus.FORBIDDEN);
    if (!canUse) throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);

    const validPlan = plan && periodStart && ['weekly', 'monthly', 'yearly'].includes(plan) ? plan as import('../quota/quota.service').PlanType : null;
    if (validPlan && periodStart) {
      const quota = await this.quotaService.checkQuota(req.user.userId, 'scorer_reports', validPlan, periodStart);
      if (!quota.allowed) {
        throw new HttpException({
          error: 'quota_exceeded', feature: quota.feature,
          limit: quota.limit, used: quota.used, resetAt: quota.resetAt,
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
  @Post('tts')
  async tts(
    @Req() req: AuthenticatedRequest,
    @Body() body: { text: string },
    @Res() reply: FastifyReply,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<void> {
    if (!body.text || typeof body.text !== 'string' || body.text.length > 2000) {
      throw new BadRequestException('Invalid text');
    }

    const [rateLimitResult, [sigResult, { canUse, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);
    if (!sigResult.valid)         { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)                  { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (rateLimitExceeded(rateLimitResult.count, subActive)) { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    logSession(req.user.userId, 'tts');
    const ac = new AbortController();
    reply.raw.on('close', () => ac.abort());
    await this.aiService.streamTts(sanitize(body.text), reply.raw, ac.signal);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('meeting-stream')
  async meetingStream(
    @Req() req: AuthenticatedRequest,
    @Body() body: { transcript: string; docText: string },
    @Res() reply: FastifyReply,
    @Headers('x-key-id') keyId: string | undefined,
    @Headers('x-timestamp') timestamp: string | undefined,
    @Headers('x-signature') signature: string | undefined,
  ): Promise<void> {
    if (!body.transcript || body.transcript.length > 4000) {
      throw new BadRequestException('Invalid transcript');
    }
    if (!body.docText || body.docText.length > 200_000) {
      throw new BadRequestException('Invalid docText');
    }

    const [rateLimitResult, [sigResult, { canUse, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);
    if (!sigResult.valid)         { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)                  { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (rateLimitExceeded(rateLimitResult.count, subActive)) { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    logSession(req.user.userId, 'meeting');
    const ac = new AbortController();
    reply.raw.on('close', () => ac.abort());
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamMeetingAnswer({
      transcript: sanitize(body.transcript),
      docText: sanitize(body.docText),
      reply: reply.raw,
      signal: ac.signal,
    });
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

    const [rateLimitResult, [sigResult, { canUse, plan, periodStart, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);
    if (!sigResult.valid)         { await reply.code(403).send({ error: sigResult.reason }); return; }
    if (!canUse)                  { await reply.code(403).send({ error: 'subscription_required' }); return; }
    if (rateLimitExceeded(rateLimitResult.count, subActive)) { await reply.code(429).send({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }); return; }

    const validPlan = plan && periodStart && ['weekly', 'monthly', 'yearly'].includes(plan) ? plan as import('../quota/quota.service').PlanType : null;
    if (validPlan && periodStart) {
      const quota = await this.quotaService.checkQuota(req.user.userId, 'doc_copilot_requests', validPlan, periodStart);
      if (!quota.allowed) {
        await reply.code(429).send({
          error: 'quota_exceeded', feature: quota.feature,
          limit: quota.limit, used: quota.used, resetAt: quota.resetAt,
        });
        return;
      }
    }

    const cleanDocs = body.documents.slice(0, 3).map((d) => ({
      docId:             sanitize(String(d.docId   ?? '').slice(0, 64)),
      fileName:          sanitize(String(d.fileName ?? '').slice(0, 256)),
      serializedContent: sanitize(String(d.serializedContent ?? '').slice(0, 200_000)),
    }));

    logSession(req.user.userId, 'doc_copilot');
    const ac = new AbortController();
    reply.raw.on('close', () => ac.abort());
    reply.raw.writeHead(200, SSE_HEADERS);
    await this.aiService.streamDocCopilot({
      transcript: sanitize(body.transcript),
      documents:  cleanDocs,
      cacheKey:   body.cacheKey ? sanitize(body.cacheKey.slice(0, 128)) : undefined,
      reply:      reply.raw,
      signal:     ac.signal,
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

    const [rateLimitResult, [sigResult, { canUse, subActive }]] = await Promise.all([
      checkRateLimit(req.user.userId).catch(() => ({ count: 0, retryAfter: 0 })),
      Promise.all([
        this.deviceService.verifySignature(req.user.userId, keyId, timestamp, signature),
        this.subscriptionService.checkAccess(req.user.userId),
      ]),
    ]);
    if (!sigResult.valid)         throw new HttpException({ error: sigResult.reason }, HttpStatus.FORBIDDEN);
    if (!canUse)                  throw new HttpException({ error: 'subscription_required' }, HttpStatus.FORBIDDEN);
    if (rateLimitExceeded(rateLimitResult.count, subActive)) throw new HttpException({ error: 'rate_limit', retryAfter: rateLimitResult.retryAfter }, 429);
    logSession(req.user.userId, 'transcribe');
    const cleanAudio = sanitize(body.audio);
    const transcript = await this.aiService.transcribe({ audio: cleanAudio });
    return { transcript };
  }
}
