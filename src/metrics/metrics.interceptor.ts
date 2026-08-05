/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter, Histogram } from 'prom-client';
import { Request, Response } from 'express';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    @InjectMetric('http_requests_total')
    private readonly httpRequestsCounter: Counter<string>,
    @InjectMetric('http_errors_total')
    private readonly httpErrorsCounter: Counter<string>,
    @InjectMetric('http_request_duration_seconds')
    private readonly httpRequestDurationHistogram: Histogram<string>,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const startTime = Date.now();
    const method = request.method || 'GET';

    return next.handle().pipe(
      tap(() => {
        const route = this.getRoutePattern(request);
        const statusCode = String(response?.statusCode || 200);
        const durationSeconds = (Date.now() - startTime) / 1000;

        this.recordMetrics(method, route, statusCode, durationSeconds);
      }),
      catchError((error: any) => {
        const route = this.getRoutePattern(request);
        const statusCode = String(error?.status || error?.statusCode || 500);
        const durationSeconds = (Date.now() - startTime) / 1000;

        this.recordMetrics(method, route, statusCode, durationSeconds);
        throw error;
      }),
    );
  }

  private recordMetrics(
    method: string,
    route: string,
    statusCode: string,
    durationSeconds: number,
  ) {
    const labels = { method, route, status_code: statusCode };

    this.httpRequestsCounter.inc(labels);
    this.httpRequestDurationHistogram.observe(labels, durationSeconds);

    if (parseInt(statusCode, 10) >= 400) {
      this.httpErrorsCounter.inc(labels);
    }
  }

  private getRoutePattern(request: Request): string {
    if (request.route?.path) {
      const prefix = request.baseUrl || '';
      return `${prefix}${request.route.path}`;
    }
    return request.path || request.url || 'unknown';
  }
}
