/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable } from '@nestjs/common';
import {
  trace,
  context,
  propagation,
  Tracer,
  Span,
  SpanKind,
  SpanStatusCode,
} from '@opentelemetry/api';

@Injectable()
export class TracingService {
  private readonly tracer: Tracer;

  constructor() {
    this.tracer = trace.getTracer('fleetpulse-tracer', '1.0.0');
  }

  /**
   * Get the active tracer instance
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  /**
   * Get current trace ID if active span exists
   */
  getTraceId(): string | undefined {
    const span = trace.getActiveSpan();
    return span?.spanContext().traceId;
  }

  /**
   * Inject current trace context into carrier object (e.g. BullMQ job data or RabbitMQ headers)
   */
  injectContext(carrier: Record<string, any> = {}): Record<string, any> {
    propagation.inject(context.active(), carrier);
    return carrier;
  }

  /**
   * Extract trace context from carrier object
   */
  extractContext(carrier: Record<string, any> = {}) {
    return propagation.extract(context.active(), carrier);
  }

  /**
   * Start a traced active span and execute a callback function within that context
   */
  async startActiveSpan<T>(
    name: string,
    carrier: Record<string, any> | undefined,
    kind: SpanKind,
    fn: (span: Span) => Promise<T> | T,
  ): Promise<T> {
    const parentContext = carrier
      ? this.extractContext(carrier)
      : context.active();

    return this.tracer.startActiveSpan(
      name,
      { kind },
      parentContext,
      async (span: Span) => {
        try {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error: any) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error?.message || 'Trace span error',
          });
          span.recordException(error);
          throw error;
        } finally {
          span.end();
        }
      },
    );
  }
}
