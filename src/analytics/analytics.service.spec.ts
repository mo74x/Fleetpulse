/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */

import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AnalyticsService } from './analytics.service';
import { Order } from '../orders/schemas/order.schema';
import { RedisService } from '../dispatch/redis/redis.service';

describe('AnalyticsService', () => {
  let service: AnalyticsService;
  let mockOrderModel: any;
  let mockRedisService: any;

  beforeEach(async () => {
    mockOrderModel = {
      aggregate: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            metrics: [
              {
                totalOrders: 10,
                totalRevenue: 500,
                deliveredCount: 8,
                failedCount: 1,
                pendingCount: 1,
                inTransitCount: 0,
                avgDeliveryTimeMinutes: 30,
              },
            ],
            statusBreakdown: [
              { _id: 'DELIVERED', count: 8 },
              { _id: 'FAILED', count: 1 },
              { _id: 'PENDING', count: 1 },
            ],
          },
        ]),
      }),
    };

    mockRedisService = {
      client: {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AnalyticsService,
        {
          provide: getModelToken(Order.name),
          useValue: mockOrderModel,
        },
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
      ],
    }).compile();

    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return overview analytics metrics and set cache', async () => {
    const overview = await service.getOverview({ merchantId: 'm_1' });

    expect(overview.totalOrders).toBe(10);
    expect(overview.totalRevenue).toBe(500);
    expect(overview.avgDeliveryTimeMinutes).toBe(30);
    expect(mockOrderModel.aggregate).toHaveBeenCalled();
    expect(mockRedisService.client.set).toHaveBeenCalled();
  });

  it('should return cached overview if available and refresh is not true', async () => {
    const cachedData = {
      totalOrders: 5,
      totalRevenue: 250,
      avgDeliveryTimeMinutes: 20,
      statusCounts: { PENDING: 0, IN_TRANSIT: 0, DELIVERED: 5, FAILED: 0 },
      statusBreakdown: { DELIVERED: 5 },
    };
    mockRedisService.client.get.mockResolvedValueOnce(
      JSON.stringify(cachedData),
    );

    const result = await service.getOverview({ merchantId: 'm_1' });

    expect(result).toEqual(cachedData);
    expect(mockOrderModel.aggregate).not.toHaveBeenCalled();
  });

  it('should return courier leaderboard', async () => {
    mockOrderModel.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce([
        {
          courierId: 'c_1',
          totalAssigned: 5,
          deliveredCount: 4,
          failedCount: 1,
          totalRevenue: 200,
          successRatePercentage: 80,
          avgDeliveryTimeMinutes: 25,
        },
      ]),
    });

    const leaderboard = await service.getCourierLeaderboard({ limit: 5 });

    expect(leaderboard).toHaveLength(1);
    expect(leaderboard[0].courierId).toBe('c_1');
    expect(leaderboard[0].successRatePercentage).toBe(80);
  });

  it('should return trend volume analytics', async () => {
    mockOrderModel.aggregate.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce([
        {
          period: '2026-08-03',
          totalOrders: 4,
          deliveredOrders: 3,
          failedOrders: 1,
          revenue: 150,
        },
      ]),
    });

    const trends = await service.getTrends({ groupBy: 'day' });

    expect(trends).toHaveLength(1);
    expect(trends[0].period).toBe('2026-08-03');
    expect(trends[0].revenue).toBe(150);
  });
});
