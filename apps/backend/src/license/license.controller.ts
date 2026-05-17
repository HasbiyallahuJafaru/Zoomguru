import { Controller, Get, Post, UseGuards, Req, Headers } from '@nestjs/common';
import { LicenseService } from './license.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('license')
@UseGuards(JwtAuthGuard)
export class LicenseController {
  constructor(private readonly licenseService: LicenseService) {}

  @Get('verify')
  async verify(
    @Req() req: any,
    @Headers('x-device-id') deviceId: string
  ) {
    return this.licenseService.verify(req.user.userId, deviceId || '');
  }

  @Post('bind')
  async bind(
    @Req() req: any,
    @Headers('x-device-id') deviceId: string
  ) {
    return this.licenseService.bind(req.user.userId, deviceId || '');
  }
}
