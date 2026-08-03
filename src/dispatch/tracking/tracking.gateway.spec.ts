import { Test, TestingModule } from '@nestjs/testing';
import { TrackingGateway } from './tracking.gateway';

import { RedisService } from '../redis/redis.service';

describe('TrackingGateway', () => {
  let gateway: TrackingGateway;

  const mockRedisService = {
    client: {
      geoAdd: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TrackingGateway,
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    gateway = module.get<TrackingGateway>(TrackingGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });
});
