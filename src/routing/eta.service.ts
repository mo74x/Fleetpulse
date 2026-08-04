/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Injectable, Logger, Optional } from '@nestjs/common';
import {
  RoutingEngineService,
  LocationCoordinates,
} from './routing-engine.service';
import { RedisService } from '../dispatch/redis/redis.service';

export interface OrderEtaResult {
  trackingNumber: string;
  courierId?: string;
  distanceKm: number;
  etaMinutes: number;
  estimatedArrival: Date;
  updatedAt: Date;
}

@Injectable()
export class EtaService {
  private readonly logger = new Logger(EtaService.name);

  constructor(
    private readonly routingEngine: RoutingEngineService,
    @Optional() private readonly redisService?: RedisService,
  ) {}

  async calculateOrderEta(
    trackingNumber: string,
    courierLocation: LocationCoordinates,
    destinationLocation: LocationCoordinates,
    courierId?: string,
  ): Promise<OrderEtaResult> {
    const { distanceKm, durationMinutes } =
      await this.routingEngine.calculateDistanceAndDuration(
        courierLocation,
        destinationLocation,
      );

    const now = new Date();
    const estimatedArrival = new Date(
      now.getTime() + durationMinutes * 60 * 1000,
    );

    const etaResult: OrderEtaResult = {
      trackingNumber,
      courierId,
      distanceKm,
      etaMinutes: durationMinutes,
      estimatedArrival,
      updatedAt: now,
    };

    // Cache ETA in Redis for quick lookup
    if (this.redisService?.client) {
      try {
        await this.redisService.client.set(
          `order:eta:${trackingNumber}`,
          JSON.stringify(etaResult),
          { EX: 300 }, // 5 minutes TTL
        );
      } catch (err: any) {
        this.logger.warn(`Failed to cache ETA in Redis: ${err?.message}`);
      }
    }

    return etaResult;
  }

  async getCachedEta(trackingNumber: string): Promise<OrderEtaResult | null> {
    if (!this.redisService?.client) return null;
    try {
      const cached = await this.redisService.client.get(
        `order:eta:${trackingNumber}`,
      );
      if (cached) {
        const parsed = JSON.parse(cached);
        parsed.estimatedArrival = new Date(parsed.estimatedArrival);
        parsed.updatedAt = new Date(parsed.updatedAt);
        return parsed;
      }
    } catch (err: any) {
      this.logger.warn(`Failed to read cached ETA from Redis: ${err?.message}`);
    }
    return null;
  }
}
