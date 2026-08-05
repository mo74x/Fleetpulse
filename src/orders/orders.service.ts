/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Inject,
  Optional,
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
import { ErrorCode } from '../common/enums/error-code.enum';

import { CorrelationContext } from '../common/context/correlation-context';
import { NotificationsService } from '../notifications/notifications.service';
import { CourierService } from '../dispatch/courier.service';
import { WebhooksService } from '../webhooks/webhooks.service';
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';
import { plainToInstance } from 'class-transformer';
import { OrderResponseDto } from './dto/order-response.dto';
import { UploadPodDto } from './dto/upload-pod.dto';
import { StorageService } from '../common/storage/storage.service';

@Injectable()
export class OrdersService {
  constructor(
    @InjectQueue('orders-queue') private ordersQueue: Queue,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @Inject('RABBITMQ_SERVICE') private readonly clientProxy: ClientProxy,
    @Optional() private readonly notificationsService?: NotificationsService,
    @Optional() private readonly courierService?: CourierService,
    @Optional() private readonly webhooksService?: WebhooksService,
    @Optional() private readonly storageService?: StorageService,
    @Optional()
    @InjectMetric('orders_created_total')
    private readonly ordersCreatedCounter?: Counter<string>,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    // Generate a mock tracking number instantly
    const trackingNumber = `BSTA-${randomUUID().substring(0, 8).toUpperCase()}-EG`;
    const correlationId = CorrelationContext.getCorrelationId();
    const createdEvent = {
      timestamp: new Date(),
      action: 'CREATED',
      actor: createOrderDto.merchantId || 'system',
    };

    const payload = {
      ...createOrderDto,
      trackingNumber,
      status: 'PENDING',
      createdAt: new Date(),
      correlationId,
      events: [createdEvent],
    };

    if (this.orderModel && typeof this.orderModel.create === 'function') {
      await this.orderModel.create({
        ...createOrderDto,
        trackingNumber,
        status: OrderStatus.PENDING,
        events: [createdEvent],
      });
    }

    // Push to Redis Queue with retry mechanisms
    await this.ordersQueue.add('process-order', payload, {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
    });

    if (this.webhooksService && createOrderDto.merchantId) {
      await this.webhooksService.dispatchOrderEvent(
        'order.created',
        createOrderDto.merchantId,
        {
          trackingNumber,
          status: OrderStatus.PENDING,
          merchantId: createOrderDto.merchantId,
          recipient: createOrderDto.recipient,
          createdAt: payload.createdAt,
        },
      );
    }

    if (this.ordersCreatedCounter) {
      this.ordersCreatedCounter.inc();
    }

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

    const [rawDocs, total] = await Promise.all([
      this.orderModel.find(filter).skip(skip).limit(limit).exec(),
      this.orderModel.countDocuments(filter).exec(),
    ]);

    const data = rawDocs.map((doc) =>
      plainToInstance(OrderResponseDto, doc.toObject ? doc.toObject() : doc, {
        excludeExtraneousValues: true,
      }),
    );

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
      throw new NotFoundException({
        errorCode: ErrorCode.ERR_ORDER_NOT_FOUND,
        message: `Order with ID or tracking number '${idOrTrackingNumber}' not found`,
      });
    }

    return order;
  }

  async getOrderHistory(idOrTrackingNumber: string) {
    const order = await this.findOne(idOrTrackingNumber);
    return {
      orderId: order._id ? order._id.toString() : undefined,
      trackingNumber: order.trackingNumber,
      status: order.status,
      events: order.events || [],
    };
  }

  async addOrderEvent(
    idOrTrackingNumber: string,
    eventData: {
      action: string;
      actor: string;
      courierId?: string;
      location?: number[];
      details?: Record<string, any>;
    },
  ): Promise<OrderDocument> {
    const order = await this.findOne(idOrTrackingNumber);
    if (!order.events) {
      order.events = [];
    }
    order.events.push({
      timestamp: new Date(),
      action: eventData.action,
      actor: eventData.actor,
      courierId: eventData.courierId || order.courierId,
      location: eventData.location,
      details: eventData.details,
    });
    return order.save();
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

    if (!order.events) {
      order.events = [];
    }

    const actor =
      updateStatusDto.actor ||
      (newStatus === OrderStatus.ASSIGNED
        ? 'system'
        : updateStatusDto.courierId || order.courierId || 'system');

    const eventRecord: any = {
      timestamp: new Date(),
      action: newStatus,
      actor,
    };
    if (updateStatusDto.courierId || order.courierId) {
      eventRecord.courierId = updateStatusDto.courierId || order.courierId;
    }
    if (updateStatusDto.location) {
      eventRecord.location = updateStatusDto.location;
    }
    if (updateStatusDto.details) {
      eventRecord.details = updateStatusDto.details;
    }

    order.events.push(eventRecord);

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

    if (
      (newStatus === OrderStatus.DELIVERED ||
        newStatus === OrderStatus.FAILED) &&
      savedOrder.courierId &&
      this.courierService
    ) {
      await this.courierService.decrementActiveOrders(savedOrder.courierId);
    }

    if (this.notificationsService) {
      await this.notificationsService.notifyOrderStatusChange(
        {
          trackingNumber: savedOrder.trackingNumber,
          merchantId: savedOrder.merchantId,
          status: savedOrder.status,
          recipient: savedOrder.recipient,
        },
        currentStatus,
      );
    }

    if (this.webhooksService && savedOrder.merchantId) {
      const eventName =
        newStatus === OrderStatus.DELIVERED
          ? 'order.delivered'
          : newStatus === OrderStatus.FAILED
            ? 'order.failed'
            : 'order.updated';

      await this.webhooksService.dispatchOrderEvent(
        eventName,
        savedOrder.merchantId,
        {
          trackingNumber: savedOrder.trackingNumber,
          status: savedOrder.status,
          previousStatus: currentStatus,
          merchantId: savedOrder.merchantId,
          courierId: savedOrder.courierId,
          updatedAt: new Date(),
        },
      );
    }

    return savedOrder;
  }

  async uploadProofOfDelivery(
    idOrTrackingNumber: string,
    files: {
      signature?: Express.Multer.File[];
      photo?: Express.Multer.File[];
    },
    uploadPodDto: UploadPodDto,
    actorCourierId?: string,
  ): Promise<OrderDocument> {
    const order = await this.findOne(idOrTrackingNumber);

    if (order.status === OrderStatus.DELIVERED) {
      throw new BadRequestException({
        errorCode: ErrorCode.ERR_POD_ALREADY_DELIVERED,
        message: 'Order is already marked as DELIVERED',
      });
    }

    if (!this.storageService) {
      throw new BadRequestException({
        errorCode: ErrorCode.ERR_STORAGE_UNAVAILABLE,
        message: 'Storage service is not available',
      });
    }

    let signatureUrl = '';
    const signatureFile = files?.signature?.[0];
    if (signatureFile) {
      signatureUrl = await this.storageService.uploadFile(
        signatureFile.buffer,
        {
          folder: 'signatures',
          contentType: signatureFile.mimetype,
        },
      );
    } else if (uploadPodDto.signatureBase64) {
      signatureUrl = await this.storageService.uploadBase64(
        uploadPodDto.signatureBase64,
        {
          folder: 'signatures',
        },
      );
    } else {
      throw new BadRequestException({
        errorCode: ErrorCode.ERR_POD_SIGNATURE_REQUIRED,
        message:
          'Recipient signature (file upload or canvas base64) is required',
      });
    }

    let photoUrl = '';
    const photoFile = files?.photo?.[0];
    if (photoFile) {
      photoUrl = await this.storageService.uploadFile(photoFile.buffer, {
        folder: 'packages',
        contentType: photoFile.mimetype,
      });
    } else {
      throw new BadRequestException({
        errorCode: ErrorCode.ERR_POD_PHOTO_REQUIRED,
        message: 'Photo of delivered package is required',
      });
    }

    const courierId = actorCourierId || order.courierId;
    const podData = {
      signatureUrl,
      photoUrl,
      location: {
        type: 'Point',
        coordinates: [uploadPodDto.longitude, uploadPodDto.latitude],
      },
      timestamp: new Date(),
      courierId,
      notes: uploadPodDto.notes,
    };

    order.proofOfDelivery = podData;

    return this.updateStatus(
      order._id ? order._id.toString() : order.trackingNumber,
      {
        status: OrderStatus.DELIVERED,
        courierId,
        actor: courierId || 'courier',
        location: [uploadPodDto.longitude, uploadPodDto.latitude],
        details: {
          pod: podData,
        },
      },
    );
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
      throw new BadRequestException({
        errorCode: ErrorCode.ERR_INVALID_TRANSITION,
        message: `Invalid status transition from ${current} to ${next}`,
      });
    }
  }
}
