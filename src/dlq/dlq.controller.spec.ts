/* eslint-disable @typescript-eslint/unbound-method */
import { DlqController } from './dlq.controller';
import { DlqService } from './dlq.service';

describe('DlqController', () => {
  let controller: DlqController;
  let service: DlqService;

  const mockDlqService = {
    getFailedJobs: jest.fn().mockResolvedValue({
      data: [{ id: 'dlq-1' }],
      meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
    }),
    getJobById: jest.fn().mockResolvedValue({ id: 'dlq-1' }),
    retryJob: jest.fn().mockResolvedValue({
      success: true,
      message: "Job re-queued successfully to queue 'orders-queue'",
      requeuedJobId: 'new-job-1',
      originalQueue: 'orders-queue',
    }),
    removeJob: jest.fn().mockResolvedValue({
      success: true,
      message: "Dead letter job 'dlq-1' removed successfully",
    }),
    purgeDlq: jest.fn().mockResolvedValue({
      success: true,
      message: 'Dead Letter Queue purged successfully',
    }),
  };

  beforeEach(() => {
    service = mockDlqService as unknown as DlqService;
    controller = new DlqController(service);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return failed jobs list', async () => {
    const result = await controller.getFailedJobs({ page: 1, limit: 10 });
    expect(result.data).toHaveLength(1);
    expect(service.getFailedJobs).toHaveBeenCalledWith({ page: 1, limit: 10 });
  });

  it('should return job details by ID', async () => {
    const result = await controller.getJobById('dlq-1');
    expect(result.id).toBe('dlq-1');
    expect(service.getJobById).toHaveBeenCalledWith('dlq-1');
  });

  it('should retry job by ID', async () => {
    const result = await controller.retryJob('dlq-1');
    expect(result.success).toBe(true);
    expect(service.retryJob).toHaveBeenCalledWith('dlq-1');
  });

  it('should remove job by ID', async () => {
    const result = await controller.removeJob('dlq-1');
    expect(result.success).toBe(true);
    expect(service.removeJob).toHaveBeenCalledWith('dlq-1');
  });

  it('should purge DLQ', async () => {
    const result = await controller.purgeDlq();
    expect(result.success).toBe(true);
    expect(service.purgeDlq).toHaveBeenCalled();
  });
});
