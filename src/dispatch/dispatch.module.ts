import { Module } from '@nestjs/common';
import { RedisService } from './redis/redis.service';
import { DispatchService } from './dispatch/dispatch.service';
import { TrackingGateway } from './tracking/tracking.gateway';

@Module({
  providers: [RedisService, DispatchService, TrackingGateway],
  exports: [DispatchService],
})
export class DispatchModule {}
