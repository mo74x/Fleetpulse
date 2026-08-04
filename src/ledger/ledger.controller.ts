/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
// src/ledger/ledger.controller.ts
import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { LedgerService } from './ledger.service';

@Controller()
export class LedgerController {
  private readonly logger = new Logger(LedgerController.name);

  constructor(private readonly ledgerService: LedgerService) {}

  @EventPattern('order.delivered')
  async handleOrderDelivered(@Payload() data: any, @Ctx() context: RmqContext) {
    this.logger.log(
      `Received order.delivered event for ${data.trackingNumber}`,
    );

    // In a real calculate this dynamically based on distance/contract
    const platformFee = 25.0;

    try {
      await this.ledgerService.processCodPayment(
        data.courierId,
        data.merchantId,
        data.packageDetails.codAmountValue,
        platformFee,
        data.trackingNumber,
      );

      // Manually acknowledge the message in RabbitMQ so it is removed from the queue
      const channel = context.getChannelRef();
      const originalMsg = context.getMessage();
      channel.ack(originalMsg);
    } catch (error) {
      this.logger.error(
        `Error processing ledger event for ${data.trackingNumber}`,
        error,
      );
      // Depending on the error, you might want to NACK (negative acknowledge) to requeue
    }
  }
}
