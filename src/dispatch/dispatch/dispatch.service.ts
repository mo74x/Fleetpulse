/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Logger,
  ConflictException,
  Optional,
} from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { OrdersService } from '../../orders/orders.service';
import { OrderStatus } from '../../orders/dto/update-order-status.dto';
import { CourierService } from '../courier.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Histogram } from 'prom-client';

@Injectable()
export class DispatchService {
  private readonly logger = new Logger(DispatchService.name);

  constructor(
    private readonly redisService: RedisService,
    private readonly ordersService: OrdersService,
    @Optional() private readonly courierService?: CourierService,
    @Optional()
    @InjectMetric('dispatch_duration_seconds')
    private readonly dispatchDurationHistogram?: Histogram<string>,
  ) {}

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
   * Auto-assign the nearest available courier or assign a specific courier with Redlock concurrency safety
   */
  async assignOrder(
    orderId: string,
    courierId?: string,
    latitude?: number,
    longitude?: number,
    radiusKm: number = 5,
  ) {
    let targetCourierId = courierId;

    if (targetCourierId) {
      if (this.courierService) {
        const eligible =
          await this.courierService.isCourierEligibleForAssignment(
            targetCourierId,
          );
        if (!eligible) {
          throw new ConflictException(
            `Courier ${targetCourierId} is currently unavailable, off-shift, or at maximum order capacity.`,
          );
        }
      }
    } else {
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

      // Filter nearby couriers for availability and shift schedule
      if (this.courierService) {
        for (const candidateId of nearbyCouriers) {
          const eligible =
            await this.courierService.isCourierEligibleForAssignment(
              candidateId,
            );
          if (eligible) {
            targetCourierId = candidateId;
            break;
          }
        }
        if (!targetCourierId) {
          throw new ConflictException(
            `All nearby couriers within ${radiusKm} km are currently unavailable, off-shift, or at max capacity.`,
          );
        }
      } else {
        targetCourierId = nearbyCouriers[0];
      }
    }

    return this.assignOrderSafely(orderId, targetCourierId);
  }

  /**
   * Assign an order to a courier with a Concurrency Lock
   */
  async assignOrderSafely(orderId: string, courierId: string) {
    const startTime = Date.now();
    const lockKey = `locks:order:dispatch:${orderId}`;
    const ttl = 5000; // Lock duration (5 seconds)

    try {
      // Attempt to acquire the distributed lock
      const lock = await this.redisService.redlock.acquire([lockKey], ttl);
      this.logger.log(
        `Lock acquired for Order ${orderId} by Courier ${courierId}`,
      );

      try {
        // Update MongoDB order state
        const updatedOrder = await this.ordersService.updateStatus(orderId, {
          status: OrderStatus.ASSIGNED,
          courierId,
        });

        // Increment active orders for courier & auto-toggle availability if max reached
        if (this.courierService) {
          await this.courierService.incrementActiveOrders(courierId);
        }

        this.logger.log(
          `Order ${orderId} successfully assigned to ${courierId}`,
        );

        if (this.dispatchDurationHistogram) {
          const durationSeconds = (Date.now() - startTime) / 1000;
          this.dispatchDurationHistogram.observe(durationSeconds);
        }

        return {
          success: true,
          orderId: updatedOrder._id.toString(),
          courierId: updatedOrder.courierId,
          status: updatedOrder.status,
        };
      } finally {
        // Release the lock
        await lock.release();
        this.logger.log(`Lock released for Order ${orderId}`);
      }
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.logger.warn(
        `Race condition or assignment failure for Order ${orderId}: ${error.message}`,
      );
      throw new ConflictException(
        `Order ${orderId} is currently being processed by another worker or courier.`,
      );
    }
  }
}
