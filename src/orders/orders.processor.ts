/* eslint-disable @typescript-eslint/no-unsafe-member-access */
// src/orders/orders.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClientProxy } from '@nestjs/microservices';

@Processor('orders-queue')
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
  ) {
    super();
  }

  process(job: Job<any, any, string>): any {
    this.logger.log(
      `Processing order job ${job.id} for tracking number: ${job.data.trackingNumber}`,
    );

    try {
      // Emit event to RabbitMQ for other microservices (like Dispatch or Ledger)
      this.rabbitClient.emit('order.created', job.data);

      this.logger.log(
        `Order ${job.data.trackingNumber} successfully processed and emitted to RabbitMQ.`,
      );
    } catch (error) {
      this.logger.error(`Failed to process order ${job.id}: ${error.message}`);
      throw error; // Triggers BullMQ retry mechanism
    }
  }
}
