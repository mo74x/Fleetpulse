/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getQueueToken } from '@nestjs/bullmq';
import { getModelToken } from '@nestjs/mongoose';
import { Order } from './schemas/order.schema';
import { StorageService } from '../common/storage/storage.service';
import { BadRequestException } from '@nestjs/common';
import { OrderStatus } from './dto/update-order-status.dto';

describe('OrdersService - Proof of Delivery (POD)', () => {
  let service: OrdersService;
  let storageService: StorageService;

  const mockOrderDoc = {
    _id: '507f1f77bcf86cd799439011',
    trackingNumber: 'BSTA-12345678-EG',
    merchantId: 'merchant-1',
    courierId: 'courier-42',
    status: OrderStatus.IN_TRANSIT,
    recipient: { name: 'John Doe', phone: '123456789' },
    packageDetails: { weightKg: 2, codAmountValue: 100, currency: 'EGP' },
    events: [],
    save: jest.fn().mockImplementation(function () {
      return Promise.resolve(this);
    }),
  };

  const mockOrderModel = {
    findById: jest.fn(),
    findOne: jest.fn(),
  };

  const mockStorageService = {
    uploadFile: jest.fn().mockImplementation((_buffer: any, options: any) => {
      if (options?.folder === 'signatures') {
        return Promise.resolve(
          'https://s3.amazonaws.com/fleetpulse-pod/signatures/sig.png',
        );
      }
      return Promise.resolve(
        'https://s3.amazonaws.com/fleetpulse-pod/packages/photo.png',
      );
    }),
    uploadBase64: jest
      .fn()
      .mockResolvedValue(
        'https://s3.amazonaws.com/fleetpulse-pod/signatures/sig.png',
      ),
  };

  const mockQueue = { add: jest.fn() };
  const mockClientProxy = { emit: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getQueueToken('orders-queue'), useValue: mockQueue },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
        { provide: 'RABBITMQ_SERVICE', useValue: mockClientProxy },
        { provide: StorageService, useValue: mockStorageService },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    storageService = module.get<StorageService>(StorageService);
    jest.clearAllMocks();
  });

  it('should upload POD with files and update order status to DELIVERED', async () => {
    const mockOrder = {
      ...mockOrderDoc,
      status: OrderStatus.IN_TRANSIT,
      events: [],
      save: jest.fn(),
    };
    mockOrder.save.mockResolvedValue(mockOrder);
    mockOrderModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOrder),
    });

    const photoFile = {
      buffer: Buffer.from('photo'),
      mimetype: 'image/png',
    } as Express.Multer.File;

    const signatureFile = {
      buffer: Buffer.from('signature'),
      mimetype: 'image/png',
    } as Express.Multer.File;

    const dto = {
      latitude: 30.0444,
      longitude: 31.2357,
      notes: 'Left at doorstep',
    };

    const result = await service.uploadProofOfDelivery(
      '507f1f77bcf86cd799439011',
      { photo: [photoFile], signature: [signatureFile] },
      dto,
      'courier-42',
    );

    expect(storageService.uploadFile).toHaveBeenCalledTimes(2);
    expect(result.status).toBe(OrderStatus.DELIVERED);
    expect(result.proofOfDelivery).toBeDefined();
    expect(result.proofOfDelivery?.signatureUrl).toBe(
      'https://s3.amazonaws.com/fleetpulse-pod/signatures/sig.png',
    );
    expect(result.proofOfDelivery?.photoUrl).toBe(
      'https://s3.amazonaws.com/fleetpulse-pod/packages/photo.png',
    );
    expect(result.proofOfDelivery?.location.coordinates).toEqual([
      31.2357, 30.0444,
    ]);
  });

  it('should accept canvas base64 signature when signature file is not provided', async () => {
    const mockOrder = {
      ...mockOrderDoc,
      status: OrderStatus.IN_TRANSIT,
      events: [],
      save: jest.fn(),
    };
    mockOrder.save.mockResolvedValue(mockOrder);
    mockOrderModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOrder),
    });

    const photoFile = {
      buffer: Buffer.from('photo'),
      mimetype: 'image/jpeg',
    } as Express.Multer.File;

    const dto = {
      latitude: 30.0444,
      longitude: 31.2357,
      signatureBase64:
        'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    };

    const result = await service.uploadProofOfDelivery(
      '507f1f77bcf86cd799439011',
      { photo: [photoFile] },
      dto,
      'courier-42',
    );

    expect(storageService.uploadBase64).toHaveBeenCalledWith(
      dto.signatureBase64,
      { folder: 'signatures' },
    );
    expect(result.status).toBe(OrderStatus.DELIVERED);
  });

  it('should throw BadRequestException if order is already DELIVERED', async () => {
    const deliveredOrder = { ...mockOrderDoc, status: OrderStatus.DELIVERED };
    mockOrderModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(deliveredOrder),
    });

    await expect(
      service.uploadProofOfDelivery(
        '507f1f77bcf86cd799439011',
        {},
        { latitude: 30.0444, longitude: 31.2357 },
        'courier-42',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if package photo is missing', async () => {
    const mockOrder = { ...mockOrderDoc, status: OrderStatus.IN_TRANSIT };
    mockOrderModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOrder),
    });

    await expect(
      service.uploadProofOfDelivery(
        '507f1f77bcf86cd799439011',
        {},
        {
          latitude: 30.0444,
          longitude: 31.2357,
          signatureBase64: 'base64data',
        },
        'courier-42',
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
