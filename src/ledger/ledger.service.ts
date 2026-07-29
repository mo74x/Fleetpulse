/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  Logger,
  InternalServerErrorException,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { Account, AccountType } from './entities/account.entity';
import { LedgerEntry } from './entities/ledger-entry.entity';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class LedgerService {
  private readonly logger = new Logger(LedgerService.name);

  constructor(@InjectDataSource() private dataSource: DataSource) {}

  /**
   * Process a Cash-on-Delivery (COD) payment when a package is delivered.
   */
  async processCodPayment(
    courierId: string,
    merchantId: string,
    codAmount: number,
    platformFee: number,
  ) {
    const queryRunner = this.dataSource.createQueryRunner();

    //Establish database connection and start transaction
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const transactionId = uuidv4();
      const merchantPayout = codAmount - platformFee;

      //Fetch Accounts with a Pessimistic Write Lock (SELECT FOR UPDATE)
      // This prevents race conditions if multiple requests hit this account simultaneously
      const courierAccount = await queryRunner.manager.findOne(Account, {
        where: {
          ownerId: courierId,
          accountType: AccountType.COURIER_CASH_HOLDING,
        },
        lock: { mode: 'pessimistic_write' },
      });

      const merchantAccount = await queryRunner.manager.findOne(Account, {
        where: {
          ownerId: merchantId,
          accountType: AccountType.MERCHANT_PAYABLE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      const platformAccount = await queryRunner.manager.findOne(Account, {
        where: {
          ownerId: 'PLATFORM',
          accountType: AccountType.PLATFORM_REVENUE,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (!courierAccount || !merchantAccount || !platformAccount) {
        throw new Error(
          'Required financial accounts do not exist. Cannot process COD.',
        );
      }

      // Update Balances (Double-Entry Logic)
      // Courier collected cash, so their holding liability increases
      courierAccount.balance = Number(courierAccount.balance) + codAmount;
      // Merchant is owed the COD amount minus the platform fee
      merchantAccount.balance =
        Number(merchantAccount.balance) + merchantPayout;
      // Platform collects its delivery fee
      platformAccount.balance = Number(platformAccount.balance) + platformFee;

      await queryRunner.manager.save([
        courierAccount,
        merchantAccount,
        platformAccount,
      ]);

      // Create Immutable Ledger Entries
      const entries = [
        queryRunner.manager.create(LedgerEntry, {
          transactionId,
          accountId: courierAccount.id,
          amount: codAmount,
          description: `COD Collected for Merchant ${merchantId}`,
        }),
        queryRunner.manager.create(LedgerEntry, {
          transactionId,
          accountId: merchantAccount.id,
          amount: merchantPayout,
          description: `Payout for COD delivery`,
        }),
        queryRunner.manager.create(LedgerEntry, {
          transactionId,
          accountId: platformAccount.id,
          amount: platformFee,
          description: `Platform fee for COD delivery`,
        }),
      ];

      await queryRunner.manager.save(entries);

      // Commit Transaction
      await queryRunner.commitTransaction();
      this.logger.log(
        `COD Transaction ${transactionId} processed successfully.`,
      );

      return { success: true, transactionId };
    } catch (error) {
      // Rollback on Failure
      await queryRunner.rollbackTransaction();
      this.logger.error(`Failed to process COD payment: ${error.message}`);
      throw new InternalServerErrorException(
        'Financial transaction failed and was rolled back.',
      );
    } finally {
      // Release the database connection
      await queryRunner.release();
    }
  }
}
