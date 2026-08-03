import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { CorrelationContext } from '../context/correlation-context';

export const CORRELATION_ID_HEADER = 'x-request-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existingId =
      (req.headers[CORRELATION_ID_HEADER] as string) ||
      (req.headers['x-correlation-id'] as string);

    const correlationId = existingId || randomUUID();

    req.headers[CORRELATION_ID_HEADER] = correlationId;
    res.setHeader('X-Request-ID', correlationId);

    CorrelationContext.run(correlationId, () => {
      next();
    });
  }
}
