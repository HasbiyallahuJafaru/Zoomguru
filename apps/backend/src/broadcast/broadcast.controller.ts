import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  Body,
  Headers,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  UseGuards,
  BadRequestException,
  HttpCode,
  Req,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { FastifyRequest } from 'fastify';
import { BroadcastService, BroadcastRow, TargetFilter } from './broadcast.service';

function safeKeyEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<FastifyRequest>();
    const key = req.headers['x-admin-key'];
    const expected = process.env['ADMIN_KEY'];
    if (!expected || typeof key !== 'string' || !safeKeyEqual(key, expected)) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}

interface CreateBroadcastBody {
  subject: string;
  body: string;
  targetFilter?: TargetFilter;
  scheduledAt?: string;
}

interface PreviewBody {
  body: string;
}

interface RecipientCountBody {
  targetFilter?: TargetFilter;
}

@UseGuards(AdminKeyGuard)
@Controller('admin/broadcast')
export class BroadcastController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Get()
  async list(): Promise<BroadcastRow[]> {
    return this.broadcastService.listBroadcasts();
  }

  @Post('recipients')
  @HttpCode(200)
  async countRecipients(
    @Body() body: RecipientCountBody,
  ): Promise<{ count: number; estimatedMinutes: number }> {
    const filter: TargetFilter = body.targetFilter ?? {};
    const count = await this.broadcastService.countRecipients(filter);
    const batchCount = Math.ceil(count / 50);
    const estimatedMinutes = batchCount > 1 ? (batchCount - 1) * 3 : 0;
    return { count, estimatedMinutes };
  }

  @Post('preview')
  @HttpCode(200)
  preview(@Body() body: PreviewBody): { html: string } {
    if (!body.body || typeof body.body !== 'string') {
      throw new BadRequestException('body is required');
    }
    return { html: this.broadcastService.buildPreviewHtml(body.body) };
  }

  @Post()
  async create(@Body() body: CreateBroadcastBody): Promise<BroadcastRow & { estimatedMinutes: number }> {
    if (!body.subject || typeof body.subject !== 'string') {
      throw new BadRequestException('subject is required');
    }
    if (!body.body || typeof body.body !== 'string') {
      throw new BadRequestException('body is required');
    }

    const filter: TargetFilter = body.targetFilter ?? {};
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();

    if (isNaN(scheduledAt.getTime())) {
      throw new BadRequestException('Invalid scheduledAt date');
    }

    const broadcast = await this.broadcastService.createBroadcast({
      subject: body.subject,
      body: body.body,
      targetFilter: filter,
      scheduledAt,
    });

    const batchCount = Math.ceil((broadcast.recipient_count ?? 0) / 50);
    const estimatedMinutes = batchCount > 1 ? (batchCount - 1) * 3 : 0;

    return { ...broadcast, estimatedMinutes };
  }

  @Delete(':id')
  @HttpCode(200)
  async cancel(@Param('id') id: string): Promise<{ ok: true }> {
    await this.broadcastService.cancelBroadcast(id);
    return { ok: true };
  }

  @Post(':id/retry')
  @HttpCode(200)
  async retry(@Param('id') id: string): Promise<BroadcastRow> {
    return this.broadcastService.retryBroadcast(id);
  }
}

// Resend webhook — NOT under AdminKeyGuard (called by Resend servers)
@Controller('broadcast')
export class BroadcastWebhookController {
  constructor(private readonly broadcastService: BroadcastService) {}

  @Post('webhook')
  @HttpCode(200)
  async handleWebhook(
    @Req() req: FastifyRequest,
    @Body() body: unknown,
    @Headers('svix-signature') svixSig: string | undefined,
  ): Promise<{ ok: true }> {
    const secret = process.env['RESEND_WEBHOOK_SECRET'];

    if (secret && !svixSig) {
      return { ok: true };
    }

    const event = body as Record<string, unknown>;
    const type = event['type'] as string | undefined;

    if (type === 'email.opened') {
      const data = event['data'] as Record<string, unknown> | undefined;
      if (data) {
        const tags = data['tags'] as Array<{ name: string; value: string }> | undefined;
        const broadcastTag = tags?.find((t) => t.name === 'broadcast_id');
        if (broadcastTag?.value) {
          await this.broadcastService.incrementOpenCount(broadcastTag.value);
        }
      }
    }

    return { ok: true };
  }
}
