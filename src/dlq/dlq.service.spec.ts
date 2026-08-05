/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { DlqService } from './dlq.service';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('DlqService', () => {
  let service: DlqService;
  let mockDlqQueue: any;
  let mockOrdersQueue: any;
  let mockWebhooksQueue: any;
  let mockNotificationsQueue: any;

  beforeEach(() => {
    mockDlqQueue = {
      add: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
      getJobs: jest.fn(),
      getJob: jest.fn(),
      drain: jest.fn().mockResolvedValue(true),
      clean: jest.fn().mockResolvedValue([]),
    };

    mockOrdersQueue = {
      add: jest.fn().mockResolvedValue({ id: 'new-order-job-1' }),
    };

    mockWebhooksQueue = {
      add: jest.fn().mockResolvedValue({ id: 'new-webhook-job-1' }),
    };

    mockNotificationsQueue = {
      add: jest.fn().mockResolvedValue({ id: 'new-notification-job-1' }),
    };

    service = new DlqService(
      mockDlqQueue,
      mockOrdersQueue,
      mockWebhooksQueue,
      mockNotificationsQueue,
    );
  });

  describe('captureFailedJob', () => {
    it('should NOT move job to DLQ if attemptsMade < maxAttempts', async () => {
      const mockJob: any = {
        id: 'job-1',
        queueName: 'orders-queue',
        attemptsMade: 1,
        opts: { attempts: 3 },
      };

      const result = await service.captureFailedJob(
        mockJob,
        new Error('Temporary failure'),
      );

      expect(result).toBeNull();
      expect(mockDlqQueue.add).not.toHaveBeenCalled();
    });

    it('should move job to DLQ when attemptsMade >= maxAttempts', async () => {
      const mockJob: any = {
        id: 'job-1',
        queueName: 'orders-queue',
        name: 'process-order',
        data: { trackingNumber: 'BSTA-1234' },
        attemptsMade: 3,
        opts: { attempts: 3 },
      };

      const result = await service.captureFailedJob(
        mockJob,
        new Error('Fatal database connection error'),
      );

      expect(result).toBeDefined();
      expect(mockDlqQueue.add).toHaveBeenCalledWith(
        'dead-letter-job',
        expect.objectContaining({
          originalQueue: 'orders-queue',
          originalJobId: 'job-1',
          failedReason: 'Fatal database connection error',
          attemptsMade: 3,
        }),
        expect.anything(),
      );
    });
  });

  describe('getFailedJobs', () => {
    it('should return paginated dead letter jobs', async () => {
      const mockJobs = [
        {
          id: 'dlq-1',
          name: 'dead-letter-job',
          data: { originalQueue: 'orders-queue' },
          timestamp: Date.now(),
        },
        {
          id: 'dlq-2',
          name: 'dead-letter-job',
          data: { originalQueue: 'webhooks-queue' },
          timestamp: Date.now(),
        },
      ];
      mockDlqQueue.getJobs.mockResolvedValue(mockJobs);

      const result = await service.getFailedJobs({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(2);
      expect(result.meta.total).toBe(2);
      expect(result.meta.totalPages).toBe(1);
    });

    it('should filter jobs by original queue when filter is provided', async () => {
      const mockJobs = [
        {
          id: 'dlq-1',
          name: 'dead-letter-job',
          data: { originalQueue: 'orders-queue' },
          timestamp: Date.now(),
        },
        {
          id: 'dlq-2',
          name: 'dead-letter-job',
          data: { originalQueue: 'webhooks-queue' },
          timestamp: Date.now(),
        },
      ];
      mockDlqQueue.getJobs.mockResolvedValue(mockJobs);

      const result = await service.getFailedJobs({
        page: 1,
        limit: 10,
        queue: 'orders-queue',
      });

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('dlq-1');
    });
  });

  describe('getJobById', () => {
    it('should return job details if found', async () => {
      const mockJob = {
        id: 'dlq-1',
        name: 'dead-letter-job',
        data: { originalQueue: 'orders-queue' },
        timestamp: Date.now(),
      };
      mockDlqQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.getJobById('dlq-1');
      expect(result.id).toBe('dlq-1');
    });

    it('should throw NotFoundException if job not found', async () => {
      mockDlqQueue.getJob.mockResolvedValue(null);

      await expect(service.getJobById('invalid-id')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('retryJob', () => {
    it('should re-queue job back to orders-queue and remove from DLQ', async () => {
      const mockDlqJob = {
        id: 'dlq-1',
        data: {
          originalQueue: 'orders-queue',
          jobName: 'process-order',
          payload: { trackingNumber: 'BSTA-9999' },
        },
        remove: jest.fn().mockResolvedValue(true),
      };
      mockDlqQueue.getJob.mockResolvedValue(mockDlqJob);

      const result = await service.retryJob('dlq-1');

      expect(result.success).toBe(true);
      expect(mockOrdersQueue.add).toHaveBeenCalledWith(
        'process-order',
        { trackingNumber: 'BSTA-9999' },
        expect.anything(),
      );
      expect(mockDlqJob.remove).toHaveBeenCalled();
    });

    it('should throw BadRequestException if target queue is unknown', async () => {
      const mockDlqJob = {
        id: 'dlq-1',
        data: {
          originalQueue: 'unknown-queue',
          jobName: 'process',
          payload: {},
        },
        remove: jest.fn(),
      };
      mockDlqQueue.getJob.mockResolvedValue(mockDlqJob);

      await expect(service.retryJob('dlq-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('removeJob', () => {
    it('should remove job from DLQ', async () => {
      const mockDlqJob = {
        id: 'dlq-1',
        remove: jest.fn().mockResolvedValue(true),
      };
      mockDlqQueue.getJob.mockResolvedValue(mockDlqJob);

      const result = await service.removeJob('dlq-1');

      expect(result.success).toBe(true);
      expect(mockDlqJob.remove).toHaveBeenCalled();
    });
  });

  describe('purgeDlq', () => {
    it('should purge all jobs from DLQ', async () => {
      const result = await service.purgeDlq();

      expect(result.success).toBe(true);
      expect(mockDlqQueue.drain).toHaveBeenCalledWith(true);
      expect(mockDlqQueue.clean).toHaveBeenCalledTimes(2);
    });
  });
});
