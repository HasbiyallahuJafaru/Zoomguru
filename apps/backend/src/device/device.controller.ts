import { Controller, Post, Body, UseGuards, Req, BadRequestException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { DeviceService } from './device.service';

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
    await this.deviceService.registerKey(req.user.userId, body.keyId, body.publicKey);
    return { success: true };
  }
}
