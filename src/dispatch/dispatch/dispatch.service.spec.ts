/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { DispatchService } from './dispatch.service';
import { RedisService } from '../redis/redis.service';
import { OrdersService } from '../../orders/orders.service';
import { CourierService } from '../courier.service';

describe('DispatchService', () => {
  let service: DispatchService;
  let mockRedisService: any;
  let mockOrdersService: any;
  let mockCourierService: any;

  beforeEach(async () => {
    mockRedisService = {
      findNearbyCouriers: jest.fn().mockResolvedValue(['c_1', 'c_2']),
      redlock: {
        acquire: jest.fn().mockResolvedValue({
          release: jest.fn().mockResolvedValue(true),
        }),
      },
    };

    mockOrdersService = {
      updateStatus: jest.fn().mockResolvedValue({
        _id: 'order_123',
        courierId: 'c_2',
        status: 'ASSIGNED',
      }),
    };

    mockCourierService = {
      isCourierEligibleForAssignment: jest
        .fn()
        .mockImplementation((id: string) => Promise.resolve(id === 'c_2')),
      incrementActiveOrders: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: OrdersService, useValue: mockOrdersService },
        { provide: CourierService, useValue: mockCourierService },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should skip ineligible nearby couriers and assign the first eligible courier', async () => {
    const result = await service.assignOrder(
      'order_123',
      undefined,
      30.0444,
      31.2357,
      5,
    );

    expect(
      mockCourierService.isCourierEligibleForAssignment,
    ).toHaveBeenCalledWith('c_1');
    expect(
      mockCourierService.isCourierEligibleForAssignment,
    ).toHaveBeenCalledWith('c_2');
    expect(mockCourierService.incrementActiveOrders).toHaveBeenCalledWith(
      'c_2',
    );
    expect(result.success).toBe(true);
  });
});
