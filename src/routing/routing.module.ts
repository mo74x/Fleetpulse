import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { RoutingEngineService } from './routing-engine.service';
import { EtaService } from './eta.service';
import { RoutingController } from './routing.controller';
import { OrdersModule } from '../orders/orders.module';
import { DispatchModule } from '../dispatch/dispatch.module';

@Module({
  imports: [ConfigModule, OrdersModule, DispatchModule],
  controllers: [RoutingController],
  providers: [RoutingEngineService, EtaService],
  exports: [RoutingEngineService, EtaService],
})
export class RoutingModule {}
