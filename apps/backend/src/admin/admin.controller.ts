import {
  Controller, Get, Patch, Param, Query, Body,
  Headers, ForbiddenException, UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../guards/admin.guard';

@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getStats(@Headers('x-admin-key') adminKey: string) {
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      throw new ForbiddenException('Unauthorized');
    }
    return this.adminService.getStats();
  }

  @Get('users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUsers(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search = '',
    @Query('plan') plan = '',
    @Query('role') role = '',
  ) {
    return this.adminService.getUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search, plan, role,
    });
  }

  @Get('users/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserDetail(@Param('id') id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch('users/:id/role')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updateUserRole(
    @Param('id') id: string,
    @Body() body: { role: 'user' | 'admin' },
    @Headers('x-admin-key') adminKey: string,
  ) {
    if (adminKey !== process.env.ADMIN_SECRET_KEY) {
      throw new ForbiddenException('Invalid admin key');
    }
    return this.adminService.updateUserRole(id, body.role);
  }

  @Patch('users/:id/license')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async toggleLicense(
    @Param('id') id: string,
    @Body() body: { active: boolean },
  ) {
    return this.adminService.toggleUserLicense(id, body.active);
  }

  @Get('payouts')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getPayouts(@Query('status') status = 'pending') {
    return this.adminService.getPayouts(status);
  }

  @Patch('payouts/:id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async updatePayout(
    @Param('id') id: string,
    @Body() body: { status: 'paid' | 'rejected'; note?: string },
  ) {
    return this.adminService.processPayout(id, body.status, body.note);
  }

  @Get('errors')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getErrors(
    @Query('page') page = '1',
    @Query('limit') limit = '50',
    @Query('search') search = '',
    @Query('endpoint') endpoint = '',
    @Query('statusCode') statusCode = '',
  ) {
    return this.adminService.getErrors({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      endpoint,
      statusCode,
    });
  }

  @Get('analytics/revenue')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getRevenueAnalytics(@Query('period') period = '30') {
    return this.adminService.getRevenueAnalytics(parseInt(period));
  }

  @Get('analytics/users')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getUserAnalytics(@Query('period') period = '30') {
    return this.adminService.getUserAnalytics(parseInt(period));
  }

  @Get('analytics/sessions')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getSessionAnalytics(@Query('period') period = '30') {
    return this.adminService.getSessionAnalytics(parseInt(period));
  }

  @Get('analytics/referrals')
  @UseGuards(JwtAuthGuard, AdminGuard)
  async getReferralAnalytics() {
    return this.adminService.getReferralAnalytics();
  }
}
