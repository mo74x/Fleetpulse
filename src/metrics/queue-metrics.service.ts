/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Gauge } from 'prom-client';

@Injectable()
export class QueueMetricsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QueueMetricsService.name);
  private intervalRef: NodeJS.Timeout | null = null;

  constructor(
    @InjectQueue('orders-queue') private readonly ordersQueue: Queue,
    @InjectQueue('notifications-queue')
    private readonly notificationsQueue: Queue,
    @InjectQueue('webhooks-queue') private readonly webhooksQueue: Queue,
    @InjectMetric('queue_depth')
    private readonly queueDepthGauge: Gauge<string>,
  ) {}

  onModuleInit() {
    // Initial collection
    void this.collectQueueMetrics();

    // Collect queue depth metrics every 15 seconds
    this.intervalRef = setInterval(() => {
      void this.collectQueueMetrics();
    }, 15000);
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
    }
  }

  async collectQueueMetrics(): Promise<void> {
    const queues = [
      { name: 'orders-queue', queue: this.ordersQueue },
      { name: 'notifications-queue', queue: this.notificationsQueue },
      { name: 'webhooks-queue', queue: this.webhooksQueue },
    ];

    for (const { name, queue } of queues) {
      try {
        if (!queue) continue;
        const counts = await queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'completed',
        );
        this.queueDepthGauge.set(
          { queue: name, status: 'waiting' },
          counts.waiting || 0,
        );
        this.queueDepthGauge.set(
          { queue: name, status: 'active' },
          counts.active || 0,
        );
        this.queueDepthGauge.set(
          { queue: name, status: 'delayed' },
          counts.delayed || 0,
        );
        this.queueDepthGauge.set(
          { queue: name, status: 'failed' },
          counts.failed || 0,
        );
        this.queueDepthGauge.set(
          { queue: name, status: 'completed' },
          counts.completed || 0,
        );
      } catch (err: any) {
        this.logger.warn(
          `Failed to collect metrics for queue ${name}: ${err?.message}`,
        );
      }
    }
  }
}
