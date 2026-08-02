/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { SearchService } from './search.service';
import { ConfigService } from '@nestjs/config';

describe('SearchService', () => {
  let service: SearchService;

  // Mock Elasticsearch client methods
  const mockEsClient = {
    indices: {
      exists: jest.fn(),
      create: jest.fn(),
    },
    index: jest.fn().mockResolvedValue({ result: 'created' }),
    update: jest.fn().mockResolvedValue({ result: 'updated' }),
    search: jest.fn(),
    ping: jest.fn().mockResolvedValue(true),
  };

  const mockConfigService = {
    get: jest.fn().mockReturnValue('http://localhost:9200'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SearchService,
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<SearchService>(SearchService);

    // Replace the internal ES client with our mock
    (service as any).esClient = mockEsClient;
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── onModuleInit ──────────────────────────────────────────────────────
  describe('onModuleInit', () => {
    it('should create the waybills index if it does not exist', async () => {
      mockEsClient.indices.exists.mockResolvedValue(false);

      await service.onModuleInit();

      expect(mockEsClient.indices.exists).toHaveBeenCalledWith({
        index: 'waybills',
      });
      expect(mockEsClient.indices.create).toHaveBeenCalledWith({
        index: 'waybills',
      });
    });

    it('should skip index creation if it already exists', async () => {
      mockEsClient.indices.exists.mockResolvedValue(true);

      await service.onModuleInit();

      expect(mockEsClient.indices.create).not.toHaveBeenCalled();
    });

    it('should not throw if Elasticsearch is unreachable', async () => {
      mockEsClient.indices.exists.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(service.onModuleInit()).resolves.not.toThrow();
    });
  });

  // ─── indexOrderDocument ────────────────────────────────────────────────
  describe('indexOrderDocument', () => {
    it('should index an order document with correct fields', async () => {
      const mockOrder = {
        _id: { toString: () => 'mongo-id-1' },
        trackingNumber: 'BSTA-ABCD1234-EG',
        status: 'PENDING',
        recipient: {
          name: 'Ahmad',
          address: { city: 'Cairo' },
        },
        courierId: 'courier-1',
        createdAt: new Date('2026-01-01'),
      };

      await service.indexOrderDocument(mockOrder);

      expect(mockEsClient.index).toHaveBeenCalledWith({
        index: 'waybills',
        id: 'mongo-id-1',
        document: {
          trackingNumber: 'BSTA-ABCD1234-EG',
          status: 'PENDING',
          recipientName: 'Ahmad',
          city: 'Cairo',
          courierId: 'courier-1',
          createdAt: new Date('2026-01-01'),
        },
      });
    });
  });

  // ─── updateOrderDocument ───────────────────────────────────────────────
  describe('updateOrderDocument', () => {
    it('should update a document in Elasticsearch', async () => {
      await service.updateOrderDocument('mongo-id-1', {
        status: 'DELIVERED',
      });

      expect(mockEsClient.update).toHaveBeenCalledWith({
        index: 'waybills',
        id: 'mongo-id-1',
        doc: { status: 'DELIVERED' },
      });
    });
  });

  // ─── searchWaybills ────────────────────────────────────────────────────
  describe('searchWaybills', () => {
    it('should return mapped search results', async () => {
      mockEsClient.search.mockResolvedValue({
        hits: {
          hits: [
            { _source: { trackingNumber: 'BSTA-0001-EG', status: 'PENDING' } },
            {
              _source: {
                trackingNumber: 'BSTA-0002-EG',
                status: 'DELIVERED',
              },
            },
          ],
        },
      });

      const results = await service.searchWaybills('BSTA');

      expect(results).toHaveLength(2);
      expect(results[0]).toEqual({
        trackingNumber: 'BSTA-0001-EG',
        status: 'PENDING',
      });
    });

    it('should pass the correct multi_match query with fuzziness', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      await service.searchWaybills('cairo');

      expect(mockEsClient.search).toHaveBeenCalledWith({
        index: 'waybills',
        query: {
          multi_match: {
            query: 'cairo',
            fields: ['trackingNumber^3', 'recipientName', 'city'],
            fuzziness: 'AUTO',
          },
        },
      });
    });

    it('should return empty array when no results found', async () => {
      mockEsClient.search.mockResolvedValue({ hits: { hits: [] } });

      const results = await service.searchWaybills('nonexistent');
      expect(results).toEqual([]);
    });
  });
});
