// src/orders/orders.service.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { CreateOrderDto } from './dto/create-order.dto';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class OrdersService {
  constructor(@InjectQueue('orders-queue') private ordersQueue: Queue) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    // Generate a mock tracking number instantly
    const trackingNumber = `BSTA-${uuidv4().substring(0, 8).toUpperCase()}-EG`;
    const payload = {
      ...createOrderDto,
      trackingNumber,
      status: 'PENDING',
      createdAt: new Date(),
    };

    // Push to Redis Queue with retry mechanisms
    await this.ordersQueue.add('process-order', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    return {
      message: 'Order accepted for processing',
      trackingNumber,
    };
  }
}
