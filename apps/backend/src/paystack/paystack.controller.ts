import { Controller, Post, Body, Get, Headers, UseGuards, Req } from '@nestjs/common';
import { PaystackService } from './paystack.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('paystack')
export class PaystackController {
  constructor(private readonly paystackService: PaystackService) {}

  @Post('initialize')
  @UseGuards(JwtAuthGuard)
  async initialize(
    @Req() req: any,
    @Body() body: { plan: 'monthly' | 'lifetime' }
  ) {
    return this.paystackService.initializeTransaction({
      userId: req.user.userId,
      email: req.user.email,
      plan: body.plan,
    });
  }

  @Post('verify-transaction')
  @UseGuards(JwtAuthGuard)
  async verifyTransaction(
    @Req() req: any,
    @Body() body: { reference: string }
  ) {
    return this.paystackService.verifyAndActivate(body.reference, req.user.userId);
  }

  @Post('webhook')
  async webhook(
    @Headers('x-paystack-signature') signature: string,
    @Body() body: any
  ) {
    return this.paystackService.handleWebhook(signature, body);
  }

  @Get('plans')
  getPlans() {
    return {
      monthly: {
        amount: 15000,
        currency: 'NGN',
        label: '₦15,000/month',
        description: 'Full access, billed monthly',
      },
      lifetime: {
        amount: 100000,
        currency: 'NGN',
        label: '₦100,000 one-time',
        description: 'Full access, pay once forever',
      },
    };
  }
}
