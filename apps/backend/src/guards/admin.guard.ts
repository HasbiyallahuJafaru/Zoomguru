import {
  CanActivate, ExecutionContext,
  Injectable, ForbiddenException
} from '@nestjs/common';
import { getDB } from '../database/db';

@Injectable()
export class AdminGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.userId;

    if (!userId) throw new ForbiddenException('Not authenticated');

    const sql = getDB();
    const [user] = await sql`
      SELECT role FROM users WHERE id = ${userId} LIMIT 1
    `;

    if (!user || user.role !== 'admin') {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
