/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { WebhooksService } from './webhooks.service';
import { WebhookSignatureUtil } from './utils/webhook-signature.util';

export interface WebhookJobData {
  subscriptionId: string;
  merchantId: string;
  url: string;
  secret: string;
  event: string;
  payload: Record<string, any>;
}

@Processor('webhooks-queue')
export class WebhooksProcessor extends WorkerHost {
  private readonly logger = new Logger(WebhooksProcessor.name);

  constructor(private readonly webhooksService: WebhooksService) {
    super();
  }

  async process(job: Job<WebhookJobData>): Promise<any> {
    const { subscriptionId, merchantId, url, secret, event, payload } =
      job.data;
    const attempt = job.attemptsMade + 1;
    const timestamp = Date.now();

    this.logger.log(
      `Delivering webhook job ${job.id} (attempt ${attempt}) [${event}] -> ${url}`,
    );

    const { headerValue } = WebhookSignatureUtil.computeSignature(
      payload,
      secret,
      timestamp,
    );

    const payloadString = JSON.stringify(payload);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    let httpStatus: number | undefined;
    let responseBody = '';
    let errorMsg = '';
    let success = false;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Id': String(job.id || timestamp),
          'X-Webhook-Timestamp': String(timestamp),
          'X-Webhook-Signature': headerValue,
          'User-Agent': 'FleetPulse-Webhooks/1.0',
        },
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      httpStatus = response.status;
      responseBody = await response.text().catch(() => '');

      if (response.ok) {
        success = true;
      } else {
        errorMsg = `Server responded with HTTP ${response.status}`;
      }
    } catch (err: any) {
      clearTimeout(timeoutId);
      errorMsg = err?.message || 'HTTP request failed';
      this.logger.error(
        `Webhook delivery failed for job ${job.id} to ${url}: ${errorMsg}`,
      );
    }

    // Log the delivery attempt in database
    await this.webhooksService.logDelivery({
      subscriptionId,
      merchantId,
      event,
      url,
      payload,
      httpStatus,
      responseBody: responseBody.slice(0, 2000), // truncate long bodies
      error: errorMsg,
      attempts: attempt,
      success,
      timestamp: new Date(),
    });

    if (!success) {
      throw new Error(
        `Webhook delivery failed [Status: ${httpStatus || 'N/A'}]: ${errorMsg}`,
      );
    }

    this.logger.log(
      `Successfully delivered webhook job ${job.id} [${event}] -> ${url}`,
    );
    return { success: true, httpStatus };
  }
}
