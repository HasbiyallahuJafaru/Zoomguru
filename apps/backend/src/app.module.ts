import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { LicenseModule } from './license/license.module';
import { AiModule } from './ai/ai.module';
import { CvModule } from './cv/cv.module';
import { SessionModule } from './session/session.module';
import { PaystackModule } from './paystack/paystack.module';
import { AdminModule } from './admin/admin.module';
import { ReferralModule } from './referral/referral.module';

@Module({
  controllers: [AppController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 10 }]),
    AuthModule,
    LicenseModule,
    AiModule,
    CvModule,
    SessionModule,
    PaystackModule,
    AdminModule,
    ReferralModule,
  ],
})
export class AppModule {}
