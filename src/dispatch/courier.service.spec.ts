/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { CourierService } from './courier.service';
import { CourierProfile } from './schemas/courier-profile.schema';

describe('CourierService', () => {
  let service: CourierService;
  let mockCourierProfileModel: any;

  beforeEach(async () => {
    mockCourierProfileModel = {
      findOne: jest.fn(),
      create: jest.fn(),
      find: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CourierService,
        {
          provide: getModelToken(CourierProfile.name),
          useValue: mockCourierProfileModel,
        },
      ],
    }).compile();

    service = module.get<CourierService>(CourierService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should auto-create courier profile if not found', async () => {
    mockCourierProfileModel.findOne.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(null),
    });
    mockCourierProfileModel.create.mockResolvedValueOnce({
      courierId: 'c_1',
      isAvailable: true,
      maxConcurrentOrders: 3,
      activeOrdersCount: 0,
      shiftStart: '00:00',
      shiftEnd: '23:59',
    });

    const profile = await service.getOrCreateProfile('c_1');
    expect(profile.courierId).toBe('c_1');
    expect(mockCourierProfileModel.create).toHaveBeenCalled();
  });

  it('should validate shift times correctly', () => {
    const daytime = new Date(2026, 7, 3, 14, 30); // 14:30 local time
    expect(service.isWithinShift('08:00', '20:00', daytime)).toBe(true);
    expect(service.isWithinShift('15:00', '22:00', daytime)).toBe(false);

    // Midnight crossover test (22:00 to 06:00)
    const lateNight = new Date(2026, 7, 3, 23, 30); // 23:30 local time
    expect(service.isWithinShift('22:00', '06:00', lateNight)).toBe(true);
  });

  it('should auto-toggle availability OFF when max concurrent orders is reached', async () => {
    const mockProfile = {
      courierId: 'c_2',
      isAvailable: true,
      maxConcurrentOrders: 2,
      activeOrdersCount: 1,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    mockCourierProfileModel.findOne.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(mockProfile),
    });

    const updated = await service.incrementActiveOrders('c_2');

    expect(updated.activeOrdersCount).toBe(2);
    expect(updated.isAvailable).toBe(false); // Toggled off!
  });

  it('should auto-toggle availability ON when active orders drop below max limit', async () => {
    const mockProfile = {
      courierId: 'c_3',
      isAvailable: false,
      maxConcurrentOrders: 2,
      activeOrdersCount: 2,
      save: jest.fn().mockImplementation(function () {
        return Promise.resolve(this);
      }),
    };

    mockCourierProfileModel.findOne.mockReturnValueOnce({
      exec: jest.fn().mockResolvedValueOnce(mockProfile),
    });

    const updated = await service.decrementActiveOrders('c_3');

    expect(updated.activeOrdersCount).toBe(1);
    expect(updated.isAvailable).toBe(true); // Toggled back on!
  });
});
