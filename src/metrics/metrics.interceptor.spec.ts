/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
import { MetricsInterceptor } from './metrics.interceptor';
import { CallHandler } from '@nestjs/common';
import { of, throwError } from 'rxjs';

describe('MetricsInterceptor', () => {
  let interceptor: MetricsInterceptor;
  let mockRequestsCounter: any;
  let mockErrorsCounter: any;
  let mockDurationHistogram: any;

  beforeEach(() => {
    mockRequestsCounter = { inc: jest.fn() };
    mockErrorsCounter = { inc: jest.fn() };
    mockDurationHistogram = { observe: jest.fn() };

    interceptor = new MetricsInterceptor(
      mockRequestsCounter,
      mockErrorsCounter,
      mockDurationHistogram,
    );
  });

  it('should pass through non-http context', (done) => {
    const context: any = {
      getType: () => 'rpc',
    };
    const next: CallHandler = {
      handle: () => of('result'),
    };

    interceptor.intercept(context, next).subscribe((res) => {
      expect(res).toBe('result');
      expect(mockRequestsCounter.inc).not.toHaveBeenCalled();
      done();
    });
  });

  it('should record metrics for successful HTTP requests', (done) => {
    const request: any = {
      method: 'GET',
      route: { path: '/api/v1/orders' },
      baseUrl: '',
    };
    const response: any = { statusCode: 200 };

    const context: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    const next: CallHandler = {
      handle: () => of('data'),
    };

    interceptor.intercept(context, next).subscribe((res) => {
      expect(res).toBe('data');
      expect(mockRequestsCounter.inc).toHaveBeenCalledWith({
        method: 'GET',
        route: '/api/v1/orders',
        status_code: '200',
      });
      expect(mockDurationHistogram.observe).toHaveBeenCalled();
      expect(mockErrorsCounter.inc).not.toHaveBeenCalled();
      done();
    });
  });

  it('should record metrics and increment error counter on HTTP error responses', (done) => {
    const request: any = {
      method: 'POST',
      route: { path: '/api/v1/orders' },
      baseUrl: '',
    };
    const response: any = { statusCode: 400 };

    const context: any = {
      getType: () => 'http',
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => response,
      }),
    };
    const error = { status: 400, message: 'Bad Request' };
    const next: CallHandler = {
      handle: () => throwError(() => error),
    };

    interceptor.intercept(context, next).subscribe({
      error: (err) => {
        expect(err).toBe(error);
        expect(mockRequestsCounter.inc).toHaveBeenCalledWith({
          method: 'POST',
          route: '/api/v1/orders',
          status_code: '400',
        });
        expect(mockErrorsCounter.inc).toHaveBeenCalledWith({
          method: 'POST',
          route: '/api/v1/orders',
          status_code: '400',
        });
        done();
      },
    });
  });
});
