import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, VersioningType } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('AppController & Versioning (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();

    // Configure global prefix and URI versioning to mirror main.ts
    app.setGlobalPrefix('api', {
      exclude: ['health', '/'],
    });

    app.enableVersioning({
      type: VersioningType.URI,
      defaultVersion: '1',
    });

    await app.init();
  });

  it('/ (GET) - Excluded from /api prefix', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect('Hello World!');
  });

  it('/health (GET) - Excluded from /api prefix', () => {
    return request(app.getHttpServer())
      .get('/health')
      .expect((res) => {
        // Status may be 200 or 503 depending on database connectivity in unit e2e context
        expect([200, 503]).toContain(res.status);
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
