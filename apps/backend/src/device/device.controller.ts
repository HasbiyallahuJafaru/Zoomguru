import { Controller, Post, Body, UseGuards, Req, BadRequestException, HttpException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeviceService } from './device.service';
import { getRedis } from '../redis/redis';

const DEV_REG_WINDOW_SEC = 3600;
const DEV_REG_MAX = 5;

async function checkDeviceRegLimit(userId: string): Promise<{ allowed: boolean; retryAfter: number }> {
  const redis = getRedis();
  const key = `rl_dev:${userId}`;
  const count = await redis.incr(key);
  // Only on the first attempt, so the window runs from then. Setting it on
  // every attempt pushed the reset an hour further out on each retry, which
  // left anyone who kept restarting the app permanently unable to register a
  // device — and the error they saw told them to restart.
  if (count === 1) await redis.expire(key, DEV_REG_WINDOW_SEC);
  if (count > DEV_REG_MAX) {
    const ttl = await redis.ttl(key);
    return { allowed: false, retryAfter: ttl > 0 ? ttl : DEV_REG_WINDOW_SEC };
  }
  return { allowed: true, retryAfter: 0 };
}

interface AuthRequest {
  user: { userId: string; email: string };
}

@Controller('device')
export class DeviceController {
  constructor(private readonly deviceService: DeviceService) {}

  @Post('register')
  @UseGuards(AuthGuard('jwt'))
  async register(
    @Req() req: AuthRequest,
    @Body() body: { keyId: string; publicKey: string },
  ): Promise<{ success: boolean }> {
    if (!body.keyId || !body.publicKey) {
      throw new BadRequestException('keyId and publicKey are required');
    }
    const rl = await checkDeviceRegLimit(req.user.userId).catch(() => ({ allowed: true, retryAfter: 0 }));
    if (!rl.allowed) {
      throw new HttpException({ error: 'rate_limit', retryAfter: rl.retryAfter }, 429);
    }
    await this.deviceService.registerKey(req.user.userId, body.keyId, body.publicKey);
    return { success: true };
  }
}
