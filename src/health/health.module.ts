import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import {
  HealthController,
  RedisHealthIndicator,
  ElasticsearchHealthIndicator,
} from './health.controller';
import { DispatchModule } from '../dispatch/dispatch.module';
import { SearchModule } from '../search/search.module';

@Module({
  imports: [TerminusModule, DispatchModule, SearchModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator, ElasticsearchHealthIndicator],
})
export class HealthModule {}
