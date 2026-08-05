import { Global, Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DlqService } from './dlq.service';
import { DlqController } from './dlq.controller';

@Global()
@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'dead-letter-queue' },
      { name: 'orders-queue' },
      { name: 'webhooks-queue' },
      { name: 'notifications-queue' },
    ),
  ],
  controllers: [DlqController],
  providers: [DlqService],
  exports: [DlqService],
})
export class DlqModule {}
