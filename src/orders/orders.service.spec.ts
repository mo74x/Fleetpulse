/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { OrdersService } from './orders.service';
import { getQueueToken } from '@nestjs/bullmq';
import { getModelToken } from '@nestjs/mongoose';
import { Order } from './schemas/order.schema';
import { NotFoundException, BadRequestException } from '@nestjs/common';

describe('OrdersService', () => {
  let service: OrdersService;

  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };

  // Helper to build a chainable Mongoose query mock
  const buildQueryChain = (resolvedValue: any) => ({
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(resolvedValue),
  });

  const mockOrderModel = {
    find: jest.fn(),
    findById: jest.fn(),
    findOne: jest.fn(),
    countDocuments: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OrdersService,
        { provide: getQueueToken('orders-queue'), useValue: mockQueue },
        { provide: getModelToken(Order.name), useValue: mockOrderModel },
      ],
    }).compile();

    service = module.get<OrdersService>(OrdersService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── createOrder ───────────────────────────────────────────────────────
  describe('createOrder', () => {
    it('should enqueue an order and return a tracking number', async () => {
      const dto = {
        merchantId: 'merchant-1',
        recipient: {
          name: 'John',
          phone: '01012345678',
          address: {
            city: 'Cairo',
            district: 'Nasr City',
            location: { type: 'Point', coordinates: [31.35, 30.06] },
          },
        },
        packageDetails: {
          weightKg: 2,
          codAmountValue: 200,
          currency: 'EGP',
        },
      };

      const result = await service.createOrder(dto);

      expect(result.message).toBe('Order accepted for processing');
      expect(result.trackingNumber).toMatch(/^BSTA-.{8}-EG$/);
      expect(mockQueue.add).toHaveBeenCalledWith(
        'process-order',
        expect.objectContaining({
          merchantId: 'merchant-1',
          trackingNumber: expect.any(String),
          status: 'PENDING',
        }),
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 2000 },
        }),
      );
    });
  });

  // ─── findAll ───────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('should return paginated orders with no filters', async () => {
      const orders = [{ trackingNumber: 'BSTA-0001-EG' }];
      mockOrderModel.find.mockReturnValue(buildQueryChain(orders));
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(1),
      });

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toEqual(orders);
      expect(result.meta).toEqual({
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
      });
      expect(mockOrderModel.find).toHaveBeenCalledWith({});
    });

    it('should apply status filter when provided', async () => {
      mockOrderModel.find.mockReturnValue(buildQueryChain([]));
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({ page: 1, limit: 5, status: 'PENDING' });

      expect(mockOrderModel.find).toHaveBeenCalledWith({ status: 'PENDING' });
    });

    it('should apply merchantId and courierId filters', async () => {
      mockOrderModel.find.mockReturnValue(buildQueryChain([]));
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(0),
      });

      await service.findAll({
        page: 1,
        limit: 10,
        merchantId: 'm-1',
        courierId: 'c-1',
      });

      expect(mockOrderModel.find).toHaveBeenCalledWith({
        merchantId: 'm-1',
        courierId: 'c-1',
      });
    });

    it('should calculate totalPages correctly', async () => {
      mockOrderModel.find.mockReturnValue(buildQueryChain([]));
      mockOrderModel.countDocuments.mockReturnValue({
        exec: jest.fn().mockResolvedValue(25),
      });

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result.meta.totalPages).toBe(3);
    });
  });

  // ─── findOne ───────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('should find an order by valid ObjectId', async () => {
      const fakeOrder = { _id: '507f1f77bcf86cd799439011', status: 'PENDING' };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakeOrder),
      });

      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toEqual(fakeOrder);
    });

    it('should fall back to trackingNumber lookup when ObjectId lookup returns null', async () => {
      const fakeOrder = { trackingNumber: 'BSTA-ABCD1234-EG' };
      mockOrderModel.findById.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakeOrder),
      });

      const result = await service.findOne('507f1f77bcf86cd799439011');
      expect(result).toEqual(fakeOrder);
      expect(mockOrderModel.findOne).toHaveBeenCalledWith({
        trackingNumber: '507f1f77bcf86cd799439011',
      });
    });

    it('should search by trackingNumber when input is not a valid ObjectId', async () => {
      const fakeOrder = { trackingNumber: 'BSTA-ABCD1234-EG' };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakeOrder),
      });

      const result = await service.findOne('BSTA-ABCD1234-EG');
      expect(result).toEqual(fakeOrder);
      // findById should NOT be called for non-ObjectId strings
      expect(mockOrderModel.findById).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when order is not found', async () => {
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(null),
      });

      await expect(service.findOne('nonexistent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── updateStatus ─────────────────────────────────────────────────────
  describe('updateStatus', () => {
    it('should update status for a valid transition (PENDING → ASSIGNED)', async () => {
      const fakeOrder = {
        _id: 'order-1',
        status: 'PENDING',
        save: jest.fn().mockResolvedValue(true),
      };
      // findOne internally calls findById
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakeOrder),
      });

      await service.updateStatus('order-1', {
        status: 'ASSIGNED' as any,
        courierId: 'courier-1',
      });

      expect(fakeOrder.status).toBe('ASSIGNED');
      expect(fakeOrder.save).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid transition (DELIVERED → PENDING)', async () => {
      const fakeOrder = {
        _id: 'order-2',
        status: 'DELIVERED',
        save: jest.fn(),
      };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakeOrder),
      });

      await expect(
        service.updateStatus('order-2', { status: 'PENDING' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow same-status update without throwing', async () => {
      const fakeOrder = {
        _id: 'order-3',
        status: 'IN_TRANSIT',
        save: jest.fn().mockResolvedValue(true),
      };
      mockOrderModel.findOne.mockReturnValue({
        exec: jest.fn().mockResolvedValue(fakeOrder),
      });

      await service.updateStatus('order-3', { status: 'IN_TRANSIT' as any });
      expect(fakeOrder.save).toHaveBeenCalled();
    });
  });
});
