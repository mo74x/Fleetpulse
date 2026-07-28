/* eslint-disable @typescript-eslint/no-misused-promises */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument } from './schemas/order.schema';
import { SearchService } from '../search/search.service';

@Injectable()
export class OrdersSyncService implements OnModuleInit {
  private readonly logger = new Logger(OrdersSyncService.name);

  constructor(
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    private readonly searchService: SearchService,
  ) {}
  onModuleInit() {
    this.logger.log('Initializing MongoDB Change Streams for Orders...');

    // Watch the orders collection for changes
    const changeStream = this.orderModel.watch();

    changeStream.on('change', async (change) => {
      try {
        if (change.operationType === 'insert') {
          await this.searchService.indexOrderDocument(change.fullDocument);
        } else if (change.operationType === 'update') {
          // Extract the updated fields
          const updatedFields = change.updateDescription.updatedFields;
          await this.searchService.updateOrderDocument(
            change.documentKey._id.toString(),
            updatedFields,
          );
        }
      } catch (error) {
        this.logger.error(
          `Error syncing change to Elasticsearch: ${error.message}`,
        );
        // In a prod push to DLQ
      }
    });

    changeStream.on('error', (error) => {
      this.logger.error(`Change Stream Error: ${error.message}`);
    });
  }
}
