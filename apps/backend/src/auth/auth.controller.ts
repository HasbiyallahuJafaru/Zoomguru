import { Controller, Post, Body, Headers, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(
    @Body() body: { email: string; password: string; name: string; deviceId?: string; refCode?: string }
  ) {
    return this.authService.register(body.email, body.password, body.name, body.deviceId || '', body.refCode);
  }

  @Post('login')
  async login(
    @Body() body: { email: string; password: string },
    @Headers('x-device-id') deviceId: string
  ) {
    return this.authService.login(body.email, body.password, deviceId || '');
  }

  @Post('refresh')
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
}
