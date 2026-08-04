import { createHmac, randomBytes, timingSafeEqual } from 'crypto';

export class WebhookSignatureUtil {
  /**
   * Generate a random secret for a webhook subscription
   */
  static generateSecret(): string {
    return `whsec_${randomBytes(24).toString('hex')}`;
  }

  /**
   * Calculate HMAC SHA-256 signature for payload
   * Header format: t=<timestamp>,v1=<hmac_hex>
   */
  static computeSignature(
    payload: string | Record<string, any>,
    secret: string,
    timestamp: number = Date.now(),
  ): { headerValue: string; timestamp: number; signature: string } {
    const rawPayload =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const signedContent = `${timestamp}.${rawPayload}`;
    const signature = createHmac('sha256', secret)
      .update(signedContent)
      .digest('hex');

    const headerValue = `t=${timestamp},v1=${signature}`;
    return { headerValue, timestamp, signature };
  }

  /**
   * Verify an incoming webhook signature header
   */
  static verifySignature(
    signatureHeader: string,
    payload: string | Record<string, any>,
    secret: string,
    toleranceMs = 300000, // 5 minutes
  ): boolean {
    if (!signatureHeader || !secret) {
      return false;
    }

    const parts = signatureHeader.split(',');
    let timestampStr: string | null = null;
    let signatureHex: string | null = null;

    for (const part of parts) {
      const [key, value] = part.trim().split('=');
      if (key === 't') timestampStr = value;
      if (key === 'v1') signatureHex = value;
    }

    if (!timestampStr || !signatureHex) {
      return false;
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return false;
    }

    // Tolerance check
    if (toleranceMs > 0 && Math.abs(Date.now() - timestamp) > toleranceMs) {
      return false;
    }

    const rawPayload =
      typeof payload === 'string' ? payload : JSON.stringify(payload);
    const expectedContent = `${timestamp}.${rawPayload}`;
    const expectedSignature = createHmac('sha256', secret)
      .update(expectedContent)
      .digest('hex');

    const expectedBuffer = Buffer.from(expectedSignature, 'utf-8');
    const actualBuffer = Buffer.from(signatureHex, 'utf-8');

    if (expectedBuffer.length !== actualBuffer.length) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, actualBuffer);
  }
}
