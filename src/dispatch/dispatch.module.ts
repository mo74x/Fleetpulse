import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { RedisService } from './redis/redis.service';
import { DispatchService } from './dispatch/dispatch.service';
import { DispatchController } from './dispatch/dispatch.controller';
import { TrackingGateway } from './tracking/tracking.gateway';
import { OrdersModule } from '../orders/orders.module';
import {
  CourierProfile,
  CourierProfileSchema,
} from './schemas/courier-profile.schema';
import { CourierService } from './courier.service';
import { CourierController } from './courier.controller';

@Module({
  imports: [
    OrdersModule,
    MongooseModule.forFeature([
      { name: CourierProfile.name, schema: CourierProfileSchema },
    ]),
  ],
  controllers: [DispatchController, CourierController],
  providers: [RedisService, DispatchService, TrackingGateway, CourierService],
  exports: [RedisService, DispatchService, CourierService],
})
export class DispatchModule {}
