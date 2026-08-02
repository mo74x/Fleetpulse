import { Module } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { DispatchService } from './dispatch/dispatch.service';
import { DispatchController } from './dispatch/dispatch.controller';
import { TrackingGateway } from './tracking/tracking.gateway';

@Module({
  controllers: [DispatchController],
  providers: [RedisService, DispatchService, TrackingGateway],
  exports: [RedisService, DispatchService],
})
export class DispatchModule {}
