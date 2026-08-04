import { WebhookSignatureUtil } from './webhook-signature.util';

describe('WebhookSignatureUtil', () => {
  const secret = WebhookSignatureUtil.generateSecret();
  const payload = { event: 'order.created', trackingNumber: 'BSTA-123456-EG' };

  it('should generate a valid secret starting with whsec_', () => {
    const generatedSecret = WebhookSignatureUtil.generateSecret();
    expect(generatedSecret).toMatch(/^whsec_[a-f0-9]{48}$/);
  });

  it('should compute signature and format header correctly', () => {
    const timestamp = 1700000000000;
    const { headerValue, signature } = WebhookSignatureUtil.computeSignature(
      payload,
      secret,
      timestamp,
    );

    expect(headerValue).toBe(`t=${timestamp},v1=${signature}`);
    expect(signature).toHaveLength(64); // SHA256 hex string length
  });

  it('should successfully verify a valid signature', () => {
    const timestamp = Date.now();
    const { headerValue } = WebhookSignatureUtil.computeSignature(
      payload,
      secret,
      timestamp,
    );

    const isValid = WebhookSignatureUtil.verifySignature(
      headerValue,
      payload,
      secret,
      300000,
    );

    expect(isValid).toBe(true);
  });

  it('should fail verification if signature payload is altered', () => {
    const timestamp = Date.now();
    const { headerValue } = WebhookSignatureUtil.computeSignature(
      payload,
      secret,
      timestamp,
    );

    const alteredPayload = { ...payload, trackingNumber: 'HACKED-999' };
    const isValid = WebhookSignatureUtil.verifySignature(
      headerValue,
      alteredPayload,
      secret,
      300000,
    );

    expect(isValid).toBe(false);
  });

  it('should fail verification if secret is incorrect', () => {
    const timestamp = Date.now();
    const { headerValue } = WebhookSignatureUtil.computeSignature(
      payload,
      secret,
      timestamp,
    );

    const isValid = WebhookSignatureUtil.verifySignature(
      headerValue,
      payload,
      WebhookSignatureUtil.generateSecret(),
      300000,
    );

    expect(isValid).toBe(false);
  });

  it('should fail verification if timestamp is expired beyond tolerance', () => {
    const oldTimestamp = Date.now() - 600000; // 10 minutes ago
    const { headerValue } = WebhookSignatureUtil.computeSignature(
      payload,
      secret,
      oldTimestamp,
    );

    const isValid = WebhookSignatureUtil.verifySignature(
      headerValue,
      payload,
      secret,
      300000, // 5 min tolerance
    );

    expect(isValid).toBe(false);
  });
});
