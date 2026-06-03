import {
  Controller,
  Get,
  Query,
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import { FastifyRequest } from 'fastify';
import {
  AdminService,
  StatsResult,
  DailyCount,
  DailyPayments,
  DailyUsage,
  DailyDownloads,
  UserRow,
} from './admin.service';

function safeKeyEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

@Injectable()
class AdminKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const key = request.headers['x-admin-key'];
    const expected = process.env['ADMIN_KEY'];
    if (!expected || typeof key !== 'string' || !safeKeyEqual(key, expected)) {
      throw new UnauthorizedException('Invalid admin key');
    }
    return true;
  }
}

function parseDays(daysParam: string | undefined): number {
  const n = parseInt(daysParam ?? '30', 10);
  if (isNaN(n)) return 30;
  return Math.min(Math.max(n, 1), 90);
}

@UseGuards(AdminKeyGuard)
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  getStats(): Promise<StatsResult> {
    return this.adminService.getStats();
  }

  @Get('signups')
  getSignups(@Query('days') daysParam?: string): Promise<DailyCount[]> {
    return this.adminService.getSignups(parseDays(daysParam));
  }

  @Get('payments')
  getPayments(@Query('days') daysParam?: string): Promise<DailyPayments[]> {
    return this.adminService.getPayments(parseDays(daysParam));
  }

  @Get('usage')
  getUsage(@Query('days') daysParam?: string): Promise<DailyUsage[]> {
    return this.adminService.getUsage(parseDays(daysParam));
  }

  @Get('downloads')
  getDownloads(@Query('days') daysParam?: string): Promise<DailyDownloads[]> {
    return this.adminService.getDownloads(parseDays(daysParam));
  }

  @Get('users')
  getUsers(@Query('offset') offsetParam?: string): Promise<UserRow[]> {
    const offset = Math.max(0, parseInt(offsetParam ?? '0', 10) || 0);
    return this.adminService.getUsers(offset);
  }
}
