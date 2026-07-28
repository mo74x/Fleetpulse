/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  WebSocketGateway,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({ cors: true, namespace: 'telemetry' })
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly redisService: RedisService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Driver Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Driver Disconnected: ${client.id}`);
  }

  @SubscribeMessage('driver_location')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { courierId: string; lon: number; lat: number },
  ) {
    const { courierId, lon, lat } = data;

    // Add or update the courier's location in the Redis Geo Set
    await this.redisService.client.geoAdd('couriers:locations', {
      longitude: lon,
      latitude: lat,
      member: courierId,
    });

    //Acknowledge receipt
    return { event: 'location_ack', status: 'updated' };
  }
}
