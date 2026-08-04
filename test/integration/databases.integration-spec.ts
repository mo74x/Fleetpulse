/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-enum-comparison */
import {
  PostgreSqlContainer,
  StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  MongoDBContainer,
  StartedMongoDBContainer,
} from '@testcontainers/mongodb';
import { RedisContainer, StartedRedisContainer } from '@testcontainers/redis';
import { DataSource, EntitySchema } from 'typeorm';
import mongoose, { Schema } from 'mongoose';
import { createClient, RedisClientType } from 'redis';

describe('Databases Integration Tests (Testcontainers)', () => {
  let postgresContainer: StartedPostgreSqlContainer;
  let mongoContainer: StartedMongoDBContainer;
  let redisContainer: StartedRedisContainer;

  let dataSource: DataSource;
  let redisClient: RedisClientType;

  // Extend timeouts for container startup
  jest.setTimeout(120000);

  beforeAll(async () => {
    // 1. Spin up PostgreSQL Container
    postgresContainer = await new PostgreSqlContainer('postgres:15-alpine')
      .withDatabase('fleetpulse_test')
      .withUsername('test_user')
      .withPassword('test_pass')
      .start();

    // 2. Spin up MongoDB Container
    mongoContainer = await new MongoDBContainer('mongo:6.0').start();

    // 3. Spin up Redis Container
    redisContainer = await new RedisContainer('redis:7-alpine').start();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }

    if (mongoose.connection && mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
    }

    if (redisClient && redisClient.isOpen) {
      await redisClient.quit();
    }

    if (postgresContainer) {
      await postgresContainer.stop();
    }

    if (mongoContainer) {
      await mongoContainer.stop();
    }

    if (redisContainer) {
      await redisContainer.stop();
    }
  });

  describe('PostgreSQL Real Queries Integration (@testcontainers/postgresql)', () => {
    beforeAll(async () => {
      // Define a simple entity schema for testing TypeORM with PostgreSQL
      dataSource = new DataSource({
        type: 'postgres',
        host: postgresContainer.getHost(),
        port: postgresContainer.getPort(),
        username: postgresContainer.getUsername(),
        password: postgresContainer.getPassword(),
        database: postgresContainer.getDatabase(),
        synchronize: true,
        logging: false,
        entities: [
          new EntitySchema({
            name: 'Account',
            tableName: 'test_accounts',
            columns: {
              id: { type: 'uuid', primary: true, generated: 'uuid' },
              name: { type: 'varchar' },
              balance: { type: 'numeric', precision: 12, scale: 2 },
            },
          }),
        ],
      });

      await dataSource.initialize();
    });

    it('should perform real SQL INSERT, SELECT, and UPDATE queries in PostgreSQL', async () => {
      const repo = dataSource.getRepository('Account');

      // INSERT query
      const newAccount = repo.create({
        name: 'Merchant Fleet Account',
        balance: 1500.5,
      });
      const savedAccount = await repo.save(newAccount);
      expect(savedAccount.id).toBeDefined();

      // SELECT query
      const foundAccount = await repo.findOneBy({ id: savedAccount.id });
      expect(foundAccount).not.toBeNull();
      expect(foundAccount?.name).toEqual('Merchant Fleet Account');
      expect(Number(foundAccount?.balance)).toEqual(1500.5);

      // UPDATE query
      await repo.update(savedAccount.id, { balance: 2000.0 });
      const updatedAccount = await repo.findOneBy({ id: savedAccount.id });
      expect(Number(updatedAccount?.balance)).toEqual(2000.0);
    });
  });

  describe('MongoDB Real Queries Integration (@testcontainers/mongodb)', () => {
    let TestOrderModel: mongoose.Model<any>;

    beforeAll(async () => {
      const connectionUri = mongoContainer.getConnectionString();
      await mongoose.connect(connectionUri);

      const OrderTestSchema = new Schema(
        {
          trackingNumber: { type: String, required: true, unique: true },
          status: { type: String, required: true },
          origin: { type: String },
          destination: { type: String },
        },
        { timestamps: true },
      );

      TestOrderModel = mongoose.model('TestOrder', OrderTestSchema);
    });

    it('should perform real MongoDB document creation, queries, and updates', async () => {
      // Create Document
      const createdOrder = await TestOrderModel.create({
        trackingNumber: 'FP-TEST-9999',
        status: 'PENDING',
        origin: 'Warehouse A',
        destination: 'Hub B',
      });

      expect(createdOrder._id).toBeDefined();
      expect(createdOrder.trackingNumber).toBe('FP-TEST-9999');

      // Query Document
      const fetchedOrder = await TestOrderModel.findOne({
        trackingNumber: 'FP-TEST-9999',
      });
      expect(fetchedOrder).not.toBeNull();
      expect(fetchedOrder.status).toBe('PENDING');

      // Update Document
      await TestOrderModel.updateOne(
        { trackingNumber: 'FP-TEST-9999' },
        { $set: { status: 'DISPATCHED' } },
      );

      const updatedOrder = await TestOrderModel.findOne({
        trackingNumber: 'FP-TEST-9999',
      });
      expect(updatedOrder.status).toBe('DISPATCHED');
    });
  });

  describe('Redis Real Queries Integration (@testcontainers/redis)', () => {
    beforeAll(async () => {
      const redisUrl = redisContainer.getConnectionUrl();
      redisClient = createClient({ url: redisUrl });
      await redisClient.connect();
    });

    it('should perform real Redis SET, GET, EXPIRE, and HASH operations', async () => {
      // SET & GET
      await redisClient.set(
        'cache:driver:101',
        JSON.stringify({ name: 'John Doe', status: 'ACTIVE' }),
      );
      const cachedDriver = await redisClient.get('cache:driver:101');
      expect(cachedDriver).not.toBeNull();
      expect(JSON.parse(cachedDriver!)).toEqual({
        name: 'John Doe',
        status: 'ACTIVE',
      });

      // HASH Operations
      await redisClient.hSet('lock:order:555', 'owner', 'dispatch-service');
      await redisClient.hSet('lock:order:555', 'ttl', '30');

      const lockOwner = await redisClient.hGet('lock:order:555', 'owner');
      expect(lockOwner).toBe('dispatch-service');

      // EXPIRE / TTL
      await redisClient.expire('cache:driver:101', 60);
      const ttl = await redisClient.ttl('cache:driver:101');
      expect(ttl).toBeGreaterThan(0);
    });
  });
});
