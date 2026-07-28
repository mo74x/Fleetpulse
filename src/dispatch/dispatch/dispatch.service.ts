/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-return */
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
    lon: number,
    lat: number,
    radiusKm: number = 5,
  ): Promise<string[]> {
    // GEOSEARCH is the modern replacement for GEORADIUS in Redis 6.2+
    const couriers = await this.redisService.client.geoSearch(
      'couriers:locations',
      { longitude: lon, latitude: lat },
      { radius: radiusKm, unit: 'km' },
    );

    return couriers; // Returns an array of courierIds
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
