/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger, Optional } from '@nestjs/common';
import { Job } from 'bullmq';
import { EmailProvider } from './providers/email.provider';
import { SmsProvider } from './providers/sms.provider';
import { PushProvider } from './providers/push.provider';
import { NotificationsGateway } from './notifications.gateway';
import { SendNotificationDto } from './dto/notification-payload.dto';
import { NotificationChannel } from './enums/notification-channel.enum';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';
import { TracingService } from '../common/tracing/tracing.service';
import { DlqService } from '../dlq/dlq.service';
import { SpanKind } from '@opentelemetry/api';

@Processor('notifications-queue')
export class NotificationsProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationsProcessor.name);

  constructor(
    private readonly emailProvider: EmailProvider,
    private readonly smsProvider: SmsProvider,
    private readonly pushProvider: PushProvider,
    private readonly notificationsGateway: NotificationsGateway,
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

  async process(job: Job<SendNotificationDto, any, string>): Promise<any> {
    const handleJob = async () => {
      const startTime = Date.now();
      const payload = job.data;
      this.logger.log(
        `Processing notification job [${job.name}] (ID: ${job.id}) for order ${payload.trackingNumber} [Status: ${payload.status}]`,
      );

      try {
        switch (job.name) {
          case 'send-email':
            if (payload.channels.includes(NotificationChannel.EMAIL)) {
              const emailTarget =
                payload.merchantEmail ||
                payload.recipientEmail ||
                'merchant@fleetpulse.com';
              this.emailProvider.sendEmail({
                to: emailTarget,
                subject: payload.title,
                text: payload.message,
              });
            }
            break;

          case 'send-sms':
            if (
              payload.channels.includes(NotificationChannel.SMS) &&
              payload.recipientPhone
            ) {
              this.smsProvider.sendSms({
                to: payload.recipientPhone,
                message: payload.message,
              });
            }
            break;

          case 'send-push':
            if (
              payload.channels.includes(NotificationChannel.PUSH) &&
              payload.pushToken
            ) {
              this.pushProvider.sendPushNotification({
                targetToken: payload.pushToken,
                title: payload.title,
                body: payload.message,
              });
            }
            break;

          case 'broadcast-inapp':
            if (
              payload.channels.includes(NotificationChannel.IN_APP) &&
              payload.merchantId
            ) {
              this.notificationsGateway.broadcastOrderStatusUpdate(
                payload.merchantId,
                {
                  trackingNumber: payload.trackingNumber,
                  status: payload.status,
                  previousStatus: payload.previousStatus,
                  message: payload.message,
                  timestamp: new Date(),
                },
              );
            }
            break;

          default:
            this.logger.warn(`Unknown notification job name: ${job.name}`);
        }

        if (this.queueJobDurationHistogram) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.queueJobDurationHistogram.observe(
            { queue: 'notifications-queue', status: 'success' },
            durationSeconds,
          );
        }
      } catch (error: any) {
        if (this.queueJobDurationHistogram) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.queueJobDurationHistogram.observe(
            { queue: 'notifications-queue', status: 'failed' },
            durationSeconds,
          );
        }
        this.logger.error(
          `Failed to execute notification job ${job.id} (${job.name}): ${error.message}`,
        );
        throw error; // Trigger BullMQ automatic retry mechanism
      }
    };

    if (this.tracingService) {
      return this.tracingService.startActiveSpan(
        'notifications-queue.process',
        (job.data as any)?._traceContext,
        SpanKind.CONSUMER,
        handleJob,
      );
    }
    return handleJob();
  }
}
