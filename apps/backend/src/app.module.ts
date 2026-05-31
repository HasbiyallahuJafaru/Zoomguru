import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './auth/auth.module';
import { AiModule } from './ai/ai.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { CronModule } from './cron/cron.module';
import { HealthController } from './health.controller';

@Module({
  imports: [ScheduleModule.forRoot(), AuthModule, AiModule, SubscriptionModule, CronModule],
  controllers: [HealthController],
})
export class AppModule {}
