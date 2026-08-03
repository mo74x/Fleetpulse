/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
import { Logger } from '@nestjs/common';

@WebSocketGateway({
  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : '*',
    credentials: true,
  },
  namespace: 'notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    this.logger.log(`Notifications WS Client Connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.log(`Notifications WS Client Disconnected: ${client.id}`);
  }

  @SubscribeMessage('join_merchant_room')
  handleJoinMerchantRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { merchantId: string },
  ) {
    const room = `merchant:${data.merchantId}`;
    void client.join(room);
    this.logger.log(`Client ${client.id} joined room: ${room}`);
    return { event: 'room_joined', room };
  }

  broadcastOrderStatusUpdate(merchantId: string, payload: any) {
    const room = `merchant:${merchantId}`;
    if (this.server) {
      this.server.to(room).emit('order_status_update', payload);
      this.logger.log(
        `[NotificationsGateway] Emitted order_status_update to room ${room} for tracking ${payload.trackingNumber}`,
      );
    } else {
      this.logger.warn(
        `[NotificationsGateway] WebSocket Server instance not ready for broadcasting to room ${room}`,
      );
    }
  }
}
