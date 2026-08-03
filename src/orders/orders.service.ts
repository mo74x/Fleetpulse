/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { ClientProxy } from '@nestjs/microservices';
import { Order, OrderDocument } from './schemas/order.schema';
import { CreateOrderDto } from './dto/create-order.dto';
import { OrderQueryDto } from './dto/order-query.dto';
import {
  UpdateOrderStatusDto,
  OrderStatus,
} from './dto/update-order-status.dto';
import { randomUUID } from 'crypto';

import { CorrelationContext } from '../common/context/correlation-context';

@Injectable()
export class OrdersService {
  constructor(
    @InjectQueue('orders-queue') private ordersQueue: Queue,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @Inject('RABBITMQ_SERVICE') private readonly clientProxy: ClientProxy,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    // Generate a mock tracking number instantly
    const trackingNumber = `BSTA-${randomUUID().substring(0, 8).toUpperCase()}-EG`;
    const correlationId = CorrelationContext.getCorrelationId();
    const payload = {
      ...createOrderDto,
      trackingNumber,
      status: 'PENDING',
      createdAt: new Date(),
      correlationId,
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

  async findAll(queryDto: OrderQueryDto) {
    const { page = 1, limit = 10, status, merchantId, courierId } = queryDto;
    const filter: Record<string, any> = {};

    if (status) {
      filter.status = status;
    }
    if (merchantId) {
      filter.merchantId = merchantId;
    }
    if (courierId) {
      filter.courierId = courierId;
    }

    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.orderModel.find(filter).skip(skip).limit(limit).exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(idOrTrackingNumber: string): Promise<OrderDocument> {
    let order: OrderDocument | null = null;

    if (isValidObjectId(idOrTrackingNumber)) {
      order = await this.orderModel.findById(idOrTrackingNumber).exec();
    }

    if (!order) {
      order = await this.orderModel
        .findOne({ trackingNumber: idOrTrackingNumber })
        .exec();
    }

    if (!order) {
      throw new NotFoundException(
        `Order with ID or tracking number '${idOrTrackingNumber}' not found`,
      );
    }

    return order;
  }

  async updateStatus(
    id: string,
    updateStatusDto: UpdateOrderStatusDto,
  ): Promise<OrderDocument> {
    const order = await this.findOne(id);
    const currentStatus = order.status as OrderStatus;
    const newStatus = updateStatusDto.status;

    this.validateStatusTransition(currentStatus, newStatus);

    order.status = newStatus;
    if (updateStatusDto.courierId) {
      order.courierId = updateStatusDto.courierId;
    }

    const savedOrder = await order.save();

    if (newStatus === OrderStatus.DELIVERED) {
      const correlationId = CorrelationContext.getCorrelationId();
      this.clientProxy.emit('order.delivered', {
        trackingNumber: savedOrder.trackingNumber,
        merchantId: savedOrder.merchantId,
        courierId: savedOrder.courierId,
        packageDetails: savedOrder.packageDetails,
        status: savedOrder.status,
        correlationId,
      });
    }

    return savedOrder;
  }

  private validateStatusTransition(
    current: OrderStatus | string,
    next: OrderStatus,
  ) {
    if (current === next) return;

    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['ASSIGNED', 'FAILED'],
      ASSIGNED: ['IN_TRANSIT', 'FAILED'],
      IN_TRANSIT: ['DELIVERED', 'FAILED'],
      DELIVERED: [],
      FAILED: [],
    };

    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(next)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${next}`,
      );
    }
  }
}
