import { Test, TestingModule } from '@nestjs/testing';
import { DispatchService } from './dispatch.service';
import { RedisService } from '../redis/redis.service';
import { OrdersService } from '../../orders/orders.service';

describe('DispatchService', () => {
  let service: DispatchService;

  const mockRedisService = {
    findNearbyCouriers: jest.fn(),
    redlock: {
      acquire: jest.fn(),
    },
  };

  const mockOrdersService = {
    updateStatus: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DispatchService,
        { provide: RedisService, useValue: mockRedisService },
        { provide: OrdersService, useValue: mockOrdersService },
      ],
    }).compile();

    service = module.get<DispatchService>(DispatchService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
