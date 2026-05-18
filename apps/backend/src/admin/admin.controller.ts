import { Controller, Get, Headers, ForbiddenException } from '@nestjs/common';
import { AdminService } from './admin.service';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  async getStats(@Headers('x-admin-key') adminKey: string) {
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      throw new ForbiddenException('Unauthorized');
    }
    return this.adminService.getStats();
  }
}
