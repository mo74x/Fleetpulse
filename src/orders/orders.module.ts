import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { OrdersProcessor } from './orders.processor';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './schemas/order.schema';
import { SearchModule } from 'src/search/search.module';
import { OrdersSyncService } from './orders.sync.service';
import { NotificationsModule } from '../notifications/notifications.module';
import { WebhooksModule } from '../webhooks/webhooks.module';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'orders-queue',
    }),
    ClientsModule.registerAsync([
      {
        name: 'RABBITMQ_SERVICE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.RMQ,
          options: {
            urls: [configService.getOrThrow<string>('RABBITMQ_URI')],
            queue: 'orders_events_queue',
            queueOptions: {
              durable: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    SearchModule,
    NotificationsModule,
    WebhooksModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrdersProcessor, OrdersSyncService],
  exports: [OrdersService],
})
export class OrdersModule {}
