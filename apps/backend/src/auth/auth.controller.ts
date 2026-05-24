import { Controller, Post, Get, Patch, Delete, Query, Body, Headers, UseGuards, Req, Res, Request } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FastifyReply } from 'fastify';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  async register(
    @Body() body: { email: string; password: string; name: string; deviceId?: string; refCode?: string; username?: string }
  ) {
    return this.authService.register(body.email, body.password, body.name, body.deviceId || '', body.refCode, body.username);
  }

  @Post('login')
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-device-id') deviceId: string
  ) {
    return this.authService.login(body.email, body.password, deviceId || '');
  }

  @Post('refresh')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  async refresh(
    @Body() body: { refreshToken: string },
    @Headers('x-device-id') deviceId: string
  ) {
    return this.authService.refresh(body.refreshToken, deviceId || '');
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(
    @Req() req: any,
    @Body() body: { refreshToken: string }
  ) {
    return this.authService.logout(req.user.userId, body.refreshToken);
  }

  @Get('check-username')
  async checkUsername(@Query('username') username: string) {
    return this.authService.checkUsername(username);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: any) {
    return this.authService.getMe(req.user.userId);
  }

  @Get('user/dashboard-summary')
  @UseGuards(JwtAuthGuard)
  async getDashboardSummary(@Req() req: any) {
    return this.authService.getDashboardSummary(req.user.userId);
  }

  @Get('user/subscription')
  @UseGuards(JwtAuthGuard)
  async getSubscription(@Req() req: any) {
    return this.authService.getUserSubscription(req.user.userId);
  }

  @Get('user/payments')
  @UseGuards(JwtAuthGuard)
  async getPayments(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('search') search = '',
    @Query('currency') currency = '',
    @Query('plan') plan = '',
  ) {
    return this.authService.getUserPayments(req.user.userId, {
      page: parseInt(page),
      limit: parseInt(limit),
      search, currency, plan,
    });
  }

  @Get('user/sessions')
  @UseGuards(JwtAuthGuard)
  async getSessions(
    @Req() req: any,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
    @Query('type') type = 'all',
    @Query('sort') sort = 'newest',
  ) {
    return this.authService.getUserSessions(req.user.userId, {
      page: parseInt(page), limit: parseInt(limit), type, sort,
    });
  }

  @Get('user/device')
  @UseGuards(JwtAuthGuard)
  async getDevice(@Req() req: any) {
    return this.authService.getUserDevice(req.user.userId);
  }

  @Patch('user/profile')
  @UseGuards(JwtAuthGuard)
  async updateProfile(
    @Req() req: any,
    @Body() body: { name?: string; username?: string },
  ) {
    return this.authService.updateProfile(req.user.userId, body.name, body.username);
  }

  @Patch('user/password')
  @UseGuards(JwtAuthGuard)
  async changePassword(
    @Req() req: any,
    @Body() body: { currentPassword: string; newPassword: string },
  ) {
    return this.authService.changePassword(req.user.userId, body.currentPassword, body.newPassword);
  }

  @Delete('user/account')
  @UseGuards(JwtAuthGuard)
  async deleteAccount(@Req() req: any) {
    return this.authService.deleteAccount(req.user.userId);
  }

  @Post('google/web')
  async googleWebAuth(
    @Body() body: { idToken: string }
  ) {
    return this.authService.handleGoogleWebAuth(body);
  }

  @Get('google/electron')
  async googleElectronInit(@Res() reply: FastifyReply) {
    const params = new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      redirect_uri: process.env.BACKEND_URL + '/auth/google/electron/callback',
      response_type: 'code',
      scope: 'openid email profile',
      state: 'electron',
    });
    reply.redirect('https://accounts.google.com/o/oauth2/v2/auth?' + params.toString());
  }

  @Get('google/electron/callback')
  async googleElectronCallback(
    @Query('code') code: string,
    @Res() reply: FastifyReply
  ) {
    const result = await this.authService.handleGoogleElectronCallback(code);
    reply.redirect('zoomguru://auth?token=' + result.electronToken);
  }

  @Post('google/electron/exchange')
  async googleElectronExchange(
    @Body() body: { token: string }
  ) {
    return this.authService.exchangeGoogleElectronToken(body.token);
  }
}
