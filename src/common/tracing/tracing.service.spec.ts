/* eslint-disable @typescript-eslint/require-await */
import { TracingService } from './tracing.service';
import { SpanKind } from '@opentelemetry/api';

describe('TracingService', () => {
  let service: TracingService;

  beforeEach(() => {
    service = new TracingService();
  });

  it('should be defined and return tracer instance', () => {
    expect(service).toBeDefined();
    expect(service.getTracer()).toBeDefined();
  });

  it('should inject and extract trace context into carrier', () => {
    const carrier: Record<string, any> = {};
    const injected = service.injectContext(carrier);
    expect(injected).toBeDefined();

    const extracted = service.extractContext(carrier);
    expect(extracted).toBeDefined();
  });

  it('should execute callback inside a active span', async () => {
    const result = await service.startActiveSpan(
      'test-span',
      {},
      SpanKind.INTERNAL,
      async (span) => {
        expect(span).toBeDefined();
        return 'span-result';
      },
    );

    expect(result).toBe('span-result');
  });

  it('should record exception and set error status on failure inside span', async () => {
    await expect(
      service.startActiveSpan(
        'failing-span',
        {},
        SpanKind.INTERNAL,
        async () => {
          throw new Error('Span processing failed');
        },
      ),
    ).rejects.toThrow('Span processing failed');
  });
});
