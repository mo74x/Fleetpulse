/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { QueueMetricsService } from './queue-metrics.service';

describe('QueueMetricsService', () => {
  let service: QueueMetricsService;
  let mockOrdersQueue: any;
  let mockNotificationsQueue: any;
  let mockWebhooksQueue: any;
  let mockGauge: any;

  beforeEach(() => {
    mockOrdersQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 5,
        active: 2,
        delayed: 0,
        failed: 1,
        completed: 10,
      }),
    };
    mockNotificationsQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 0,
        active: 1,
        delayed: 0,
        failed: 0,
        completed: 20,
      }),
    };
    mockWebhooksQueue = {
      getJobCounts: jest.fn().mockResolvedValue({
        waiting: 1,
        active: 0,
        delayed: 0,
        failed: 0,
        completed: 5,
      }),
    };
    mockGauge = { set: jest.fn() };

    service = new QueueMetricsService(
      mockOrdersQueue,
      mockNotificationsQueue,
      mockWebhooksQueue,
      mockGauge,
    );
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should collect queue depth metrics correctly', async () => {
    await service.collectQueueMetrics();

    expect(mockGauge.set).toHaveBeenCalledWith(
      { queue: 'orders-queue', status: 'waiting' },
      5,
    );
    expect(mockGauge.set).toHaveBeenCalledWith(
      { queue: 'orders-queue', status: 'active' },
      2,
    );
    expect(mockGauge.set).toHaveBeenCalledWith(
      { queue: 'notifications-queue', status: 'active' },
      1,
    );
    expect(mockGauge.set).toHaveBeenCalledWith(
      { queue: 'webhooks-queue', status: 'waiting' },
      1,
    );
  });
});
