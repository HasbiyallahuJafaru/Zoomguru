import { Module } from '@nestjs/common';
import { BroadcastService } from './broadcast.service';
import { BroadcastQueueService } from './broadcast-queue.service';
import { BroadcastController, BroadcastWebhookController } from './broadcast.controller';

@Module({
  providers: [BroadcastService, BroadcastQueueService],
  controllers: [BroadcastController, BroadcastWebhookController],
})
export class BroadcastModule {}
