/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import Client from 'redlock';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  public client: RedisClientType;
  public redlock: Client;

  constructor(private configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<number>('REDIS_PORT');

    this.client = createClient({
      url: `redis://${host}:${port}`,
    });

    // Initialize Redlock with our Redis client
    this.redlock = new Client([this.client as any], {
      driftFactor: 0.01, // in ms
      retryCount: 3,
      retryDelay: 200, // in ms
      retryJitter: 200, // in ms
    });
  }

  async onModuleInit() {
    await this.client.connect();
    this.logger.log('Raw Redis Client Connected (Geo & Locks)');
  }

  async findNearbyCouriers(
    latitude: number,
    longitude: number,
    radiusKm: number = 5,
  ): Promise<string[]> {
    const couriers = await this.client.geoSearch(
      'couriers:locations',
      { longitude, latitude },
      { radius: radiusKm, unit: 'km' },
    );
    return couriers;
  }

  async onModuleDestroy() {
    await this.client.quit();
  }
}
