/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { EtaService } from './eta.service';
import { RoutingEngineService } from './routing-engine.service';
import { RedisService } from '../dispatch/redis/redis.service';

describe('EtaService', () => {
  let service: EtaService;
  let mockRoutingEngine: any;
  let mockRedisService: any;

  beforeEach(async () => {
    mockRoutingEngine = {
      calculateDistanceAndDuration: jest.fn().mockResolvedValue({
        distanceKm: 12.5,
        durationMinutes: 25,
      }),
    };

    mockRedisService = {
      client: {
        set: jest.fn().mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue(
          JSON.stringify({
            trackingNumber: 'BSTA-12345-EG',
            distanceKm: 12.5,
            etaMinutes: 25,
            estimatedArrival: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          }),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EtaService,
        { provide: RoutingEngineService, useValue: mockRoutingEngine },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    service = module.get<EtaService>(EtaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateOrderEta', () => {
    it('should calculate ETA and store it in Redis cache', async () => {
      const courierLoc = { lat: 30.0, lng: 31.0 };
      const destLoc = { lat: 30.1, lng: 31.1 };

      const result = await service.calculateOrderEta(
        'BSTA-12345-EG',
        courierLoc,
        destLoc,
        'courier_1',
      );

      expect(result.distanceKm).toBe(12.5);
      expect(result.etaMinutes).toBe(25);
      expect(mockRedisService.client.set).toHaveBeenCalledWith(
        'order:eta:BSTA-12345-EG',
        expect.any(String),
        { EX: 300 },
      );
    });
  });

  describe('getCachedEta', () => {
    it('should return parsed ETA from Redis cache', async () => {
      const result = await service.getCachedEta('BSTA-12345-EG');

      expect(result).not.toBeNull();
      expect(result?.trackingNumber).toBe('BSTA-12345-EG');
      expect(result?.etaMinutes).toBe(25);
    });
  });
});
