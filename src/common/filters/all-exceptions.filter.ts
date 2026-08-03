import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { CorrelationContext } from '../context/correlation-context';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    // Skip non-HTTP contexts (e.g. WebSocket / RPC microservices) if response object is not present
    if (!response || typeof response.status !== 'function') {
      this.logger.error('Unhandled exception outside HTTP context:', exception);
      return;
    }

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const correlationId =
      CorrelationContext.getCorrelationId() ||
      (request.headers?.['x-request-id'] as string) ||
      'N/A';

    let message: string | object = 'Internal Server Error';

    if (isHttpException) {
      const res = exception.getResponse();
      message = typeof res === 'object' ? res : { message: res };
    }

    const logPayload = {
      statusCode: status,
      path: request.url,
      method: request.method,
      requestId: correlationId,
      error: exception instanceof Error ? exception.message : String(exception),
      stack: exception instanceof Error ? exception.stack : undefined,
    };

    if (status >= 500) {
      this.logger.error(
        `[${request.method}] ${request.url} - Status ${status} - Error: ${logPayload.error}`,
        exception instanceof Error ? exception.stack : undefined,
      );
    } else {
      this.logger.warn(
        `[${request.method}] ${request.url} - Status ${status} - Warning: ${JSON.stringify(logPayload.error)}`,
      );
    }

    const responseBody = {
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      method: request.method,
      requestId: correlationId,
      ...(typeof message === 'object' ? message : { message }),
    };

    response.status(status).json(responseBody);
  }
}
