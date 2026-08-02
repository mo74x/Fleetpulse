/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, ConflictException } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(private readonly redisService: RedisService) {}

  /**
   * Find couriers within a specific radius (e.g., 5 km)
   */
  async findNearbyCouriers(
    lat: number,
    lon: number,
    radiusKm: number = 5,
  ): Promise<string[]> {
    return this.redisService.findNearbyCouriers(lat, lon, radiusKm);
  }

  /**
   * Auto-assign the nearest courier or assign a specific courier with Redlock concurrency safety
   */
  async assignOrder(
    orderId: string,
    courierId?: string,
    latitude?: number,
    longitude?: number,
    radiusKm: number = 5,
  ) {
    let targetCourierId = courierId;

    if (!targetCourierId) {
      if (latitude === undefined || longitude === undefined) {
        throw new ConflictException(
          'Either courierId or latitude and longitude must be provided for assignment.',
        );
      }
      const nearbyCouriers = await this.findNearbyCouriers(
        latitude,
        longitude,
        radiusKm,
      );
      if (!nearbyCouriers || nearbyCouriers.length === 0) {
        throw new ConflictException(
          `No nearby couriers found within ${radiusKm} km radius.`,
        );
      }
      targetCourierId = nearbyCouriers[0];
    }

    return this.assignOrderSafely(orderId, targetCourierId);
  }

  /**
   * Assign an order to a courier with a Concurrency Lock
   */
  async assignOrderSafely(orderId: string, courierId: string) {
    const lockKey = `locks:order:dispatch:${orderId}`;
    const ttl = 5000; // Lock duration (5 seconds)

    try {
      // Attempt to acquire the distributed lock
      const lock = await this.redisService.redlock.acquire([lockKey], ttl);
      this.logger.log(
        `Lock acquired for Order ${orderId} by Courier ${courierId}`,
      );

      try {
        // Perform the business logic
        // Simulate database latency
        await new Promise((resolve) => setTimeout(resolve, 500));

        this.logger.log(
          `Order ${orderId} successfully assigned to ${courierId}`,
        );

        return { success: true, orderId, courierId, status: 'ASSIGNED' };
      } finally {
        // Release the lock
        await lock.release();
        this.logger.log(`Lock released for Order ${orderId}`);
      }
    } catch (error) {
      // Redlock throws an ExecutionError if the lock is already held
      this.logger.warn(
        `Race condition prevented! Order ${orderId} is currently being dispatched.`,
      );
      throw new ConflictException(
        `Order ${orderId} is currently being processed by another worker or courier.`,
      );
    }
  }
}
