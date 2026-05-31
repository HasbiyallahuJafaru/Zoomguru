import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { DeviceModule } from '../device/device.module';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  imports: [AuthModule, SubscriptionModule, DeviceModule],
  controllers: [AiController],
  providers: [AiService],
})
export class AiModule {}
