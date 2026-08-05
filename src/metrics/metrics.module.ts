import { Module } from '@nestjs/common';
import {
  PrometheusModule,
  makeCounterProvider,
  makeHistogramProvider,
  makeGaugeProvider,
} from '@willsoto/nestjs-prometheus';
import { MetricsInterceptor } from './metrics.interceptor';
import { QueueMetricsService } from './queue-metrics.service';
import { BullModule } from '@nestjs/bullmq';

export const METRICS = {
  ORDERS_CREATED_TOTAL: 'orders_created_total',
  DISPATCH_DURATION_SECONDS: 'dispatch_duration_seconds',
  QUEUE_DEPTH: 'queue_depth',
  QUEUE_JOB_DURATION_SECONDS: 'queue_job_duration_seconds',
  HTTP_REQUESTS_TOTAL: 'http_requests_total',
  HTTP_ERRORS_TOTAL: 'http_errors_total',
  HTTP_REQUEST_DURATION_SECONDS: 'http_request_duration_seconds',
};

const providers = [
  makeCounterProvider({
    name: METRICS.ORDERS_CREATED_TOTAL,
    help: 'Total number of orders created',
  }),
  makeHistogramProvider({
    name: METRICS.DISPATCH_DURATION_SECONDS,
    help: 'Time taken to dispatch and assign an order in seconds',
    buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),
  makeGaugeProvider({
    name: METRICS.QUEUE_DEPTH,
    help: 'Current number of jobs in BullMQ queues',
    labelNames: ['queue', 'status'],
  }),
  makeHistogramProvider({
    name: METRICS.QUEUE_JOB_DURATION_SECONDS,
    help: 'Processing latency of queue jobs in seconds',
    labelNames: ['queue', 'status'],
    buckets: [0.005, 0.01, 0.05, 0.1, 0.5, 1, 2.5, 5, 10],
  }),
  makeCounterProvider({
    name: METRICS.HTTP_REQUESTS_TOTAL,
    help: 'Total number of HTTP requests handled',
    labelNames: ['method', 'route', 'status_code'],
  }),
  makeCounterProvider({
    name: METRICS.HTTP_ERRORS_TOTAL,
    help: 'Total number of HTTP error responses (>= 400)',
    labelNames: ['method', 'route', 'status_code'],
  }),
  makeHistogramProvider({
    name: METRICS.HTTP_REQUEST_DURATION_SECONDS,
    help: 'HTTP request execution duration in seconds',
    labelNames: ['method', 'route', 'status_code'],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  }),
];

@Module({
  imports: [
    PrometheusModule.register({
      path: '/metrics',
      defaultMetrics: {
        enabled: true,
      },
    }),
    BullModule.registerQueue(
      { name: 'orders-queue' },
      { name: 'notifications-queue' },
      { name: 'webhooks-queue' },
    ),
  ],
  providers: [...providers, MetricsInterceptor, QueueMetricsService],
  exports: [
    PrometheusModule,
    ...providers,
    MetricsInterceptor,
    QueueMetricsService,
  ],
})
export class MetricsModule {}
