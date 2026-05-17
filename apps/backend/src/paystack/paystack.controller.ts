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
    @Body() body: { plan: 'monthly' | 'lifetime'; currency: 'NGN' | 'USD' }
  ) {
    return this.paystackService.initializeTransaction({
      userId: req.user.userId,
      email: req.user.email,
      plan: body.plan,
      currency: body.currency,
    });
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
      ngn: {
        monthly: {
          amount: 15000,
          currency: 'NGN',
          label: '15,000/month',
          description: 'Full access, billed monthly',
        },
        lifetime: {
          amount: 100000,
          currency: 'NGN',
          label: '100,000 one-time',
          description: 'Full access, pay once forever',
        },
      },
      usd: {
        monthly: {
          amount: 12,
          currency: 'USD',
          label: '$12/month',
          description: 'Full access, billed monthly',
        },
        lifetime: {
          amount: 79,
          currency: 'USD',
          label: '$79 one-time',
          description: 'Full access, pay once forever',
        },
      },
    };
  }
}
