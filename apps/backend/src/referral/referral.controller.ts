import { Controller, Get, Post, Body, UseGuards, Req } from '@nestjs/common';
import { ReferralService } from './referral.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('referral')
@UseGuards(JwtAuthGuard)
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('stats')
  getStats(@Req() req: any) {
    return this.referralService.getStats(req.user.userId);
  }

  @Get('banks')
  getBanks() {
    return this.referralService.getBanks();
  }

  @Post('verify-account')
  verifyAccount(@Body() body: { accountNumber: string; bankCode: string }) {
    return this.referralService.verifyBankAccount(body.accountNumber, body.bankCode);
  }

  @Post('payout')
  requestPayout(
    @Req() req: any,
    @Body() body: {
      amount: number;
      currency: string;
      bankName: string;
      bankCode: string;
      accountNumber: string;
      accountName: string;
    },
  ) {
    return this.referralService.requestPayout(req.user.userId, body);
  }
}
