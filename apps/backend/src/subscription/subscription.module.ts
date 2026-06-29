import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { PaymentsController } from './payments.controller';
import { SubscriptionService } from './subscription.service';
import { EmailModule } from '../email/email.module';
import { QuotaModule } from '../quota/quota.module';

@Module({
  imports: [EmailModule, QuotaModule],
  controllers: [SubscriptionController, PaymentsController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
