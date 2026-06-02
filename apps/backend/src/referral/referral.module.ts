import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { ReferralController } from './referral.controller';
import { ReferralService } from './referral.service';

@Module({
  imports: [PassportModule],
  controllers: [ReferralController],
  providers: [ReferralService],
})
export class ReferralModule {}
