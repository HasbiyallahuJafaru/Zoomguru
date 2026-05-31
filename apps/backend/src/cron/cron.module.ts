import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { CronService } from './cron.service';

@Module({
  imports: [EmailModule],
  providers: [CronService],
})
export class CronModule {}
