import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { DeviceModule } from './device/device.module';
import { CronModule } from './cron/cron.module';
import { AdminModule } from './admin/admin.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { ReferralModule } from './referral/referral.module';
import { BroadcastModule } from './broadcast/broadcast.module';
import { HealthController } from './health.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    AuthModule,
    AiModule,
    SubscriptionModule,
    DeviceModule,
    CronModule,
    AdminModule,
    AnalyticsModule,
    ReferralModule,
    BroadcastModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
