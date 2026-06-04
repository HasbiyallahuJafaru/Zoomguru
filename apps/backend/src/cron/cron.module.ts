import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { QuotaModule } from '../quota/quota.module';
import { CronService } from './cron.service';

@Module({
  imports: [EmailModule, QuotaModule],
  providers: [CronService],
})
export class CronModule {}
