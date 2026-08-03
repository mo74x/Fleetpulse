/* eslint-disable @typescript-eslint/unbound-method */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { UserRole } from '../auth/user-role.enum';

describe('AnalyticsController', () => {
  let controller: AnalyticsController;
  let service: AnalyticsService;

  beforeEach(async () => {
    const mockAnalyticsService = {
      getOverview: jest.fn().mockResolvedValue({
        totalOrders: 10,
        totalRevenue: 500,
        avgDeliveryTimeMinutes: 25,
      }),
      getCourierLeaderboard: jest
        .fn()
        .mockResolvedValue([{ courierId: 'c_1', successRatePercentage: 90 }]),
      getTrends: jest
        .fn()
        .mockResolvedValue([{ period: '2026-08-03', totalOrders: 5 }]),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        {
          provide: AnalyticsService,
          useValue: mockAnalyticsService,
        },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    service = module.get<AnalyticsService>(AnalyticsService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call getOverview with merchant scope from req', async () => {
    const req = { user: { role: UserRole.MERCHANT, userId: 'm_123' } };
    const query = {};

    const result = await controller.getOverview(query, req);

    expect(service.getOverview).toHaveBeenCalledWith({
      merchantId: 'm_123',
    });
    expect(result).toBeDefined();
  });

  it('should call getCouriersLeaderboard', async () => {
    const req = { user: { role: UserRole.ADMIN, userId: 'admin_1' } };
    const query = { limit: 5 };

    const result = await controller.getCouriersLeaderboard(query, req);

    expect(service.getCourierLeaderboard).toHaveBeenCalledWith({ limit: 5 });
    expect(result).toHaveLength(1);
  });

  it('should call getTrends', async () => {
    const req = { user: { role: UserRole.MERCHANT, userId: 'm_123' } };
    const query = { groupBy: 'week' as const };

    const result = await controller.getTrends(query, req);

    expect(service.getTrends).toHaveBeenCalledWith({
      groupBy: 'week',
      merchantId: 'm_123',
    });
    expect(result).toHaveLength(1);
  });
});
