import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { RedisService } from '../redis/redis.service';
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
  },
  namespace: 'telemetry',
})
export class TrackingGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(TrackingGateway.name);

  constructor(private readonly redisService: RedisService) {}

  handleConnection(client: Socket) {
    this.logger.log(`Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Client Disconnected: ${client.id}`);
  }

  @SubscribeMessage('subscribe_order_eta')
  handleSubscribeOrderEta(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { trackingNumber: string },
  ) {
    if (data?.trackingNumber) {
      const room = `order:${data.trackingNumber}`;
      void client.join(room);
      this.logger.log(`Client ${client.id} joined room ${room}`);
      return { event: 'subscribed', room };
    }
  }

  @SubscribeMessage('driver_location')
  async handleLocationUpdate(
    @ConnectedSocket() client: Socket,
    @MessageBody()
    data: {
      courierId: string;
      lon: number;
      lat: number;
      trackingNumber?: string;
      destLat?: number;
      destLng?: number;
    },
  ) {
    const { courierId, lon, lat, trackingNumber, destLat, destLng } = data;

    // Add or update the courier's location in the Redis Geo Set
    if (this.redisService?.client) {
      await this.redisService.client.geoAdd('couriers:locations', {
        longitude: lon,
        latitude: lat,
        member: courierId,
      });
    }

    // If destination coordinates are provided, compute quick distance/ETA and broadcast
    if (trackingNumber && destLat !== undefined && destLng !== undefined) {
      const dLat = ((destLat - lat) * Math.PI) / 180;
      const dLon = ((destLng - lon) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat * Math.PI) / 180) *
          Math.cos((destLat * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distKm = Math.round(6371 * c * 1.3 * 100) / 100;
      const etaMinutes = Math.round((distKm / 30) * 60 * 10) / 10;

      const etaPayload = {
        trackingNumber,
        courierId,
        currentLocation: { lat, lng: lon },
        distanceKm: distKm,
        etaMinutes,
        estimatedArrival: new Date(Date.now() + etaMinutes * 60 * 1000),
        timestamp: new Date(),
      };

      if (this.server) {
        this.server
          .to(`order:${trackingNumber}`)
          .emit('eta_update', etaPayload);
      }
    }

    // Acknowledge receipt
    return { event: 'location_ack', status: 'updated' };
  }
}
