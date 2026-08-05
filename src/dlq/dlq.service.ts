/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue, Job } from 'bullmq';
import { DeadLetterJobPayload } from './interfaces/dead-letter-job.interface';
import { DlqQueryDto } from './dto/dlq-query.dto';

@Injectable()
export class DlqService {
  private readonly logger = new Logger(DlqService.name);

  constructor(
    @InjectQueue('dead-letter-queue') private dlqQueue: Queue,
    @InjectQueue('orders-queue') private ordersQueue: Queue,
    @InjectQueue('webhooks-queue') private webhooksQueue: Queue,
    @InjectQueue('notifications-queue') private notificationsQueue: Queue,
  ) {}

  /**
   * Capture a failed job into Dead Letter Queue if max retries are exhausted
   */
  async captureFailedJob(job: Job<any>, error: Error): Promise<Job | null> {
    const attemptsMade = job.attemptsMade || 1;
    const maxAttempts = job.opts?.attempts || 3;

    if (attemptsMade < maxAttempts) {
      this.logger.debug(
        `Job ${job.id} on queue ${job.queueName} failed (attempt ${attemptsMade}/${maxAttempts}). Retrying...`,
      );
      return null;
    }

    this.logger.warn(
      `Job ${job.id} on queue ${job.queueName} exhausted all ${maxAttempts} retries. Moving to Dead Letter Queue.`,
    );

    const dlqPayload: DeadLetterJobPayload = {
      originalQueue: job.queueName,
      originalJobId: String(job.id || ''),
      jobName: job.name,
      payload: job.data,
      failedReason: error?.message || 'Job execution failed',
      stackTrace: error?.stack,
      failedAt: new Date().toISOString(),
      attemptsMade,
    };

    return this.dlqQueue.add('dead-letter-job', dlqPayload, {
      removeOnComplete: false,
      removeOnFail: false,
    });
  }

  /**
   * List jobs currently stored in the Dead Letter Queue
   */
  async getFailedJobs(query: DlqQueryDto) {
    const page = query.page || 1;
    const limit = query.limit || 10;
    const start = (page - 1) * limit;
    const end = start + limit;

    const allJobs = await this.dlqQueue.getJobs([
      'waiting',
      'delayed',
      'completed',
      'failed',
      'active',
    ]);

    let filtered = allJobs.map((j) => ({
      id: j.id,
      name: j.name,
      data: j.data as DeadLetterJobPayload,
      timestamp: j.timestamp,
    }));

    if (query.queue) {
      filtered = filtered.filter((j) => j.data?.originalQueue === query.queue);
    }

    const total = filtered.length;
    const data = filtered.slice(start, end);
    const totalPages = Math.ceil(total / limit) || 1;

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * Get details for a specific dead-letter job
   */
  async getJobById(jobId: string) {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(
        `Dead letter job with ID '${jobId}' not found`,
      );
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data as DeadLetterJobPayload,
      timestamp: job.timestamp,
    };
  }

  /**
   * Re-queue a failed job back to its original target queue
   */
  async retryJob(jobId: string) {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(
        `Dead letter job with ID '${jobId}' not found`,
      );
    }

    const dlqData = job.data as DeadLetterJobPayload;
    const targetQueueName = dlqData?.originalQueue;
    const originalJobName = dlqData?.jobName || 'process';
    const payload = dlqData?.payload;

    if (!targetQueueName) {
      throw new BadRequestException(
        'Target queue name missing in DLQ metadata',
      );
    }

    let targetQueue: Queue;
    switch (targetQueueName) {
      case 'orders-queue':
        targetQueue = this.ordersQueue;
        break;
      case 'webhooks-queue':
        targetQueue = this.webhooksQueue;
        break;
      case 'notifications-queue':
        targetQueue = this.notificationsQueue;
        break;
      default:
        throw new BadRequestException(
          `Unknown target queue for replay: '${targetQueueName}'`,
        );
    }

    // Re-add job to target queue
    const requeuedJob = await targetQueue.add(originalJobName, payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    // Remove job from DLQ after successful re-queueing
    await job.remove();

    this.logger.log(
      `Re-queued dead letter job ${jobId} back to target queue ${targetQueueName} as new job ${requeuedJob.id}`,
    );

    return {
      success: true,
      message: `Job re-queued successfully to queue '${targetQueueName}'`,
      requeuedJobId: requeuedJob.id,
      originalQueue: targetQueueName,
    };
  }

  /**
   * Delete a single job from the Dead Letter Queue
   */
  async removeJob(jobId: string) {
    const job = await this.dlqQueue.getJob(jobId);
    if (!job) {
      throw new NotFoundException(
        `Dead letter job with ID '${jobId}' not found`,
      );
    }

    await job.remove();
    this.logger.log(`Removed dead letter job ${jobId}`);

    return {
      success: true,
      message: `Dead letter job '${jobId}' removed successfully`,
    };
  }

  /**
   * Purge all jobs from the Dead Letter Queue
   */
  async purgeDlq() {
    await this.dlqQueue.drain(true);
    await this.dlqQueue.clean(0, 0, 'completed');
    await this.dlqQueue.clean(0, 0, 'failed');

    this.logger.log('Dead Letter Queue fully purged');
    return {
      success: true,
      message: 'Dead Letter Queue purged successfully',
    };
  }
}
