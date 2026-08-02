/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  TypeOrmHealthIndicator,
  MongooseHealthIndicator,
  HealthIndicator,
  HealthIndicatorResult,
} from '@nestjs/terminus';
import { Injectable } from '@nestjs/common';
import { RedisService } from '../dispatch/redis/redis.service';
import { SearchService } from '../search/search.service';

@Injectable()
export class RedisHealthIndicator extends HealthIndicator {
  constructor(private readonly redisService: RedisService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      const pong = await this.redisService.client.ping();
      const isHealthy = pong === 'PONG';
      return this.getStatus(key, isHealthy);
    } catch (error) {
      return this.getStatus(key, false, { message: (error as Error).message });
    }
  }
}

@Injectable()
export class ElasticsearchHealthIndicator extends HealthIndicator {
  constructor(private readonly searchService: SearchService) {
    super();
  }

  async isHealthy(key: string): Promise<HealthIndicatorResult> {
    try {
      // Accessing underlying ES client to ping
      const ping = await (this.searchService as any).esClient.ping();
      return this.getStatus(key, Boolean(ping));
    } catch (error) {
      return this.getStatus(key, false, { message: (error as Error).message });
    }
  }
}

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private db: TypeOrmHealthIndicator,
    private mongo: MongooseHealthIndicator,
    private redisIndicator: RedisHealthIndicator,
    private elasticsearchIndicator: ElasticsearchHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.db.pingCheck('postgres'),
      () => this.mongo.pingCheck('mongodb'),
      () => this.redisIndicator.isHealthy('redis'),
      () => this.elasticsearchIndicator.isHealthy('elasticsearch'),
    ]);
  }
}
