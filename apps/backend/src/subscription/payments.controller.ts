import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
  HttpCode,
  BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SubscriptionService } from './subscription.service';

interface AuthRequest {
  user: { userId: string; email: string };
}

// Hosted-checkout endpoints. The desktop app calls /payments/create (authed) to
// mint a checkout link; the public checkout page on zoomguru.xyz calls
// /payments/session and /payments/confirm. The Paystack secret never leaves the
// server, and session tokens are single-use (see SubscriptionService).
@Controller('payments')
export class PaymentsController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Post('create')
  @UseGuards(AuthGuard('jwt'))
  async create(@Req() req: AuthRequest, @Body() body: { plan?: string }) {
    if (!body?.plan || typeof body.plan !== 'string') {
      throw new BadRequestException('plan is required');
    }
    return this.subscriptionService.createCheckout(req.user.userId, req.user.email, body.plan);
  }

  @Get('session')
  async session(@Query('session') token: string) {
    return this.subscriptionService.getCheckout(token);
  }

  @Post('confirm')
  @HttpCode(200)
  async confirm(@Body() body: { session?: string; reference?: string }) {
    if (!body?.session || !body?.reference) {
      throw new BadRequestException('session and reference are required');
    }
    return this.subscriptionService.confirmCheckout(body.session, body.reference);
  }
}
