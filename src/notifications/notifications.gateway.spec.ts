/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsGateway } from './notifications.gateway';

describe('NotificationsGateway', () => {
  let gateway: NotificationsGateway;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [NotificationsGateway],
    }).compile();

    gateway = module.get<NotificationsGateway>(NotificationsGateway);
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  it('should join merchant room on join_merchant_room message', () => {
    const mockSocket = {
      id: 'socket_123',
      join: jest.fn(),
    } as any;

    const result = gateway.handleJoinMerchantRoom(mockSocket, {
      merchantId: 'm_456',
    });

    expect(mockSocket.join).toHaveBeenCalledWith('merchant:m_456');
    expect(result).toEqual({
      event: 'room_joined',
      room: 'merchant:m_456',
    });
  });

  it('should broadcast order status update if server is present', () => {
    const mockServer = {
      to: jest.fn().mockReturnValue({
        emit: jest.fn(),
      }),
    } as any;

    gateway.server = mockServer;

    gateway.broadcastOrderStatusUpdate('m_456', {
      trackingNumber: 'BSTA-TEST',
      status: 'DELIVERED',
    });

    expect(mockServer.to).toHaveBeenCalledWith('merchant:m_456');
  });
});
