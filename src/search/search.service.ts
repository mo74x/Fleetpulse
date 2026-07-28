/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from '@elastic/elasticsearch';

@Injectable()
export class SearchService implements OnModuleInit {
  private readonly logger = new Logger(SearchService.name);
  private esClient: Client;
  private readonly indexName = 'waybills';

  constructor(private configService: ConfigService) {
    this.esClient = new Client({
      node: this.configService.get<string>('ELASTICSEARCH_NODE'),
    });
  }

  async onModuleInit() {
    try {
      const indexExists = await this.esClient.indices.exists({
        index: this.indexName,
      });
      if (!indexExists) {
        await this.esClient.indices.create({ index: this.indexName });
        this.logger.log(`Created Elasticsearch index: ${this.indexName}`);
      }
    } catch (error) {
      this.logger.error('Failed to initialize Elasticsearch index', error);
    }
  }

  // Called by our MongoDB Change Stream
  async indexOrderDocument(order: any) {
    await this.esClient.index({
      index: this.indexName,
      id: order._id.toString(), // Use Mongo ID as ES ID
      document: {
        trackingNumber: order.trackingNumber,
        status: order.status,
        recipientName: order.recipient.name,
        city: order.recipient.address.city,
        courierId: order.courierId,
        createdAt: order.createdAt,
      },
    });
    this.logger.log(`Indexed order ${order.trackingNumber} to Elasticsearch`);
  }

  // Called by our MongoDB Change Stream for status updates
  async updateOrderDocument(id: string, updateFields: any) {
    await this.esClient.update({
      index: this.indexName,
      id,
      doc: updateFields,
    });
  }
  // The Fuzzy Search method
  async searchWaybills(searchTerm: string) {
    const result = await this.esClient.search({
      index: this.indexName,
      query: {
        multi_match: {
          query: searchTerm,
          fields: ['trackingNumber^3', 'recipientName', 'city'], // Boost trackingNumber weight
          fuzziness: 'AUTO', // Handles typos
        },
      },
    });

    return result.hits.hits.map((hit) => hit._source);
  }
}
