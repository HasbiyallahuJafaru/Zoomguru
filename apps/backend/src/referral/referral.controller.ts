import {
  Controller, Get, Post, Body, UseGuards, Req, BadRequestException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ReferralService } from './referral.service';

interface AuthRequest {
  user: { userId: string; email: string };
}

@Controller('referral')
@UseGuards(AuthGuard('jwt'))
export class ReferralController {
  constructor(private readonly referralService: ReferralService) {}

  @Get('dashboard')
  getDashboard(@Req() req: AuthRequest) {
    return this.referralService.getDashboard(req.user.userId);
  }

  @Get('banks')
  listBanks() {
    return this.referralService.listBanks();
  }

  @Post('bank/verify')
  verifyAccount(
    @Body() body: { accountNumber?: string; bankCode?: string },
  ) {
    if (!body.accountNumber || !/^\d{10}$/.test(body.accountNumber)) {
      throw new BadRequestException('accountNumber must be a 10-digit string');
    }
    if (!body.bankCode || body.bankCode.length > 10) {
      throw new BadRequestException('bankCode is required');
    }
    return this.referralService.verifyAccount(body.accountNumber, body.bankCode);
  }

  @Post('bank/save')
  saveBank(
    @Req() req: AuthRequest,
    @Body() body: {
      accountNumber?: string;
      bankCode?: string;
      bankName?: string;
      accountName?: string;
    },
  ) {
    if (!body.accountNumber || !body.bankCode || !body.bankName || !body.accountName) {
      throw new BadRequestException('accountNumber, bankCode, bankName, accountName are required');
    }
    return this.referralService.saveBank(
      req.user.userId,
      body.accountNumber,
      body.bankCode,
      body.bankName,
      body.accountName,
    );
  }

  @Post('payout/request')
  requestPayout(@Req() req: AuthRequest) {
    return this.referralService.requestPayout(req.user.userId);
  }
}
