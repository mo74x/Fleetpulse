import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import {
  RoutingEngineService,
  LocationCoordinates,
} from './routing-engine.service';

describe('RoutingEngineService', () => {
  let service: RoutingEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RoutingEngineService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<RoutingEngineService>(RoutingEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateHaversineRoute', () => {
    it('should calculate realistic distance and duration between Cairo locations', () => {
      const origin: LocationCoordinates = { lat: 30.0444, lng: 31.2357 }; // Tahrir Square
      const destination: LocationCoordinates = { lat: 30.0771, lng: 31.2859 }; // Heliopolis

      const result = service.calculateHaversineRoute(origin, destination);

      expect(result.distanceKm).toBeGreaterThan(5);
      expect(result.distanceKm).toBeLessThan(20);
      expect(result.durationMinutes).toBeGreaterThan(10);
    });
  });

  describe('calculateDistanceAndDuration', () => {
    it('should fallback to Haversine route calculation when external APIs are unconfigured', async () => {
      const origin = { lat: 30.0, lng: 31.0 };
      const destination = { lat: 30.1, lng: 31.1 };

      const result = await service.calculateDistanceAndDuration(
        origin,
        destination,
      );

      expect(result.distanceKm).toBeGreaterThan(0);
      expect(result.durationMinutes).toBeGreaterThan(0);
    });
  });

  describe('optimizeMultiStopRoute', () => {
    it('should optimize route for multiple waypoints starting from origin', async () => {
      const origin = { lat: 30.0, lng: 31.0 };
      const waypoints = [
        { id: 'stop-far', location: { lat: 30.5, lng: 31.5 } },
        { id: 'stop-near', location: { lat: 30.05, lng: 31.05 } },
        { id: 'stop-mid', location: { lat: 30.2, lng: 31.2 } },
      ];

      const result = await service.optimizeMultiStopRoute(origin, waypoints);

      expect(result.orderedWaypoints).toHaveLength(3);
      // Nearest neighbor should visit stop-near first
      expect(result.orderedWaypoints[0].id).toBe('stop-near');
      expect(result.orderedWaypoints[1].id).toBe('stop-mid');
      expect(result.orderedWaypoints[2].id).toBe('stop-far');
      expect(result.legs).toHaveLength(3);
      expect(result.totalDistanceKm).toBeGreaterThan(0);
      expect(result.totalDurationMinutes).toBeGreaterThan(0);
    }, 30000);

    it('should handle empty waypoints array gracefully', async () => {
      const origin = { lat: 30.0, lng: 31.0 };
      const result = await service.optimizeMultiStopRoute(origin, []);

      expect(result.orderedWaypoints).toEqual([]);
      expect(result.totalDistanceKm).toBe(0);
    });
  });
});
