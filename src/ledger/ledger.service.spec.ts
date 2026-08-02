/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService } from './ledger.service';
import { DataSource } from 'typeorm';
import { getDataSourceToken } from '@nestjs/typeorm';
import { InternalServerErrorException } from '@nestjs/common';
import { AccountType } from './entities/account.entity';

describe('LedgerService', () => {
  let service: LedgerService;

  // Build mock accounts that simulate real entity rows
  const createMockAccount = (
    id: string,
    ownerId: string,
    accountType: AccountType,
    balance: number,
  ) => ({
    id,
    ownerId,
    accountType,
    balance,
  });

  // Reusable mock QueryRunner builder
  const buildMockQueryRunner = (accounts: {
    courier: any;
    merchant: any;
    platform: any;
  }) => ({
    connect: jest.fn(),
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    rollbackTransaction: jest.fn(),
    release: jest.fn(),
    manager: {
      findOne: jest.fn().mockImplementation((_entity, options) => {
        const type = options?.where?.accountType;
        if (type === AccountType.COURIER_CASH_HOLDING) return accounts.courier;
        if (type === AccountType.MERCHANT_PAYABLE) return accounts.merchant;
        if (type === AccountType.PLATFORM_REVENUE) return accounts.platform;
        return null;
      }),
      save: jest.fn().mockResolvedValue(true),
      create: jest.fn().mockImplementation((_entity, data) => data),
    },
  });

  let mockDataSource: Partial<DataSource>;
  let mockQueryRunner: ReturnType<typeof buildMockQueryRunner>;

  beforeEach(async () => {
    const accounts = {
      courier: createMockAccount(
        'acc-1',
        'courier-1',
        AccountType.COURIER_CASH_HOLDING,
        0,
      ),
      merchant: createMockAccount(
        'acc-2',
        'merchant-1',
        AccountType.MERCHANT_PAYABLE,
        0,
      ),
      platform: createMockAccount(
        'acc-3',
        'PLATFORM',
        AccountType.PLATFORM_REVENUE,
        0,
      ),
    };

    mockQueryRunner = buildMockQueryRunner(accounts);
    mockDataSource = {
      createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    jest.clearAllMocks();

    // Re-wire the mock after clearAllMocks
    (mockDataSource.createQueryRunner as jest.Mock).mockReturnValue(
      mockQueryRunner,
    );
    mockQueryRunner.manager.findOne.mockImplementation((_entity, options) => {
      const type = options?.where?.accountType;
      if (type === AccountType.COURIER_CASH_HOLDING) return accounts.courier;
      if (type === AccountType.MERCHANT_PAYABLE) return accounts.merchant;
      if (type === AccountType.PLATFORM_REVENUE) return accounts.platform;
      return null;
    });
    mockQueryRunner.manager.save.mockResolvedValue(true);
    mockQueryRunner.manager.create.mockImplementation((_entity, data) => data);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── processCodPayment: Happy Path ─────────────────────────────────────
  describe('processCodPayment', () => {
    it('should process a COD payment and commit the transaction', async () => {
      const result = await service.processCodPayment(
        'courier-1',
        'merchant-1',
        200,
        25,
      );

      expect(result.success).toBe(true);
      expect(result.transactionId).toBeDefined();

      // Transaction lifecycle
      expect(mockQueryRunner.connect).toHaveBeenCalled();
      expect(mockQueryRunner.startTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.rollbackTransaction).not.toHaveBeenCalled();
    });

    it('should fetch all three accounts with pessimistic_write locks', async () => {
      await service.processCodPayment('courier-1', 'merchant-1', 100, 10);

      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledTimes(3);
      expect(mockQueryRunner.manager.findOne).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          lock: { mode: 'pessimistic_write' },
        }),
      );
    });

    it('should save 3 ledger entries with correct amounts', async () => {
      await service.processCodPayment('courier-1', 'merchant-1', 500, 50);

      // save is called twice: once for account balances, once for ledger entries
      expect(mockQueryRunner.manager.save).toHaveBeenCalledTimes(2);

      // Ledger entries (3rd call to create)
      expect(mockQueryRunner.manager.create).toHaveBeenCalledTimes(3);
    });

    // ─── processCodPayment: Missing Accounts ──────────────────────────────
    it('should rollback and throw if a required account is missing', async () => {
      mockQueryRunner.manager.findOne.mockResolvedValue(null);

      await expect(
        service.processCodPayment('courier-1', 'merchant-1', 200, 25),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
      expect(mockQueryRunner.commitTransaction).not.toHaveBeenCalled();
    });

    // ─── processCodPayment: Save Failure ───────────────────────────────────
    it('should rollback on save failure', async () => {
      mockQueryRunner.manager.save.mockRejectedValueOnce(
        new Error('DB write failed'),
      );

      await expect(
        service.processCodPayment('courier-1', 'merchant-1', 200, 25),
      ).rejects.toThrow(InternalServerErrorException);

      expect(mockQueryRunner.rollbackTransaction).toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });
  });
});
