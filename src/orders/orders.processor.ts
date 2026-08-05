/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Inject, Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { ClientProxy } from '@nestjs/microservices';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { TracingService } from '../common/tracing/tracing.service';
import { DlqService } from '../dlq/dlq.service';
import { SpanKind } from '@opentelemetry/api';

@Processor('orders-queue')
export class OrdersProcessor extends WorkerHost {
  private readonly logger = new Logger(OrdersProcessor.name);

  constructor(
    @Inject('RABBITMQ_SERVICE') private readonly rabbitClient: ClientProxy,
    @Optional()
    @InjectMetric('queue_job_duration_seconds')
    private readonly queueJobDurationHistogram?: Histogram<string>,
    @Optional() private readonly tracingService?: TracingService,
    @Optional() private readonly dlqService?: DlqService,
  ) {
    super();
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error) {
    if (this.dlqService) {
      await this.dlqService.captureFailedJob(job, error);
    }
  }

  async process(job: Job<any, any, string>): Promise<any> {
    const handleJob = () => {
      const startTime = Date.now();
      this.logger.log(
        `Processing order job ${job.id} for tracking number: ${job.data.trackingNumber}`,
      );

      try {
        // Emit event to RabbitMQ for other microservices (like Dispatch or Ledger)
        this.rabbitClient.emit('order.created', job.data);

        this.logger.log(
          `Order ${job.data.trackingNumber} successfully processed and emitted to RabbitMQ.`,
        );

        if (this.queueJobDurationHistogram) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.queueJobDurationHistogram.observe(
            { queue: 'orders-queue', status: 'success' },
            durationSeconds,
          );
        }
      } catch (error: any) {
        if (this.queueJobDurationHistogram) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.queueJobDurationHistogram.observe(
            { queue: 'orders-queue', status: 'failed' },
            durationSeconds,
          );
        }
        this.logger.error(
          `Failed to process order ${job.id}: ${error.message}`,
        );
        throw error; // Triggers BullMQ retry mechanism
      }
    };

    if (this.tracingService) {
      return this.tracingService.startActiveSpan(
        'orders-queue.process',
        job.data?._traceContext,
        SpanKind.CONSUMER,
        handleJob,
      );
    }
    return handleJob();
  }
}
