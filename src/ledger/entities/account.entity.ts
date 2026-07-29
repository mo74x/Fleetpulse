import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  UpdateDateColumn,
} from 'typeorm';

export enum AccountType {
  COURIER_CASH_HOLDING = 'COURIER_CASH_HOLDING',
  MERCHANT_PAYABLE = 'MERCHANT_PAYABLE',
  PLATFORM_REVENUE = 'PLATFORM_REVENUE',
}

@Entity('accounts')
export class Account {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 50 })
  ownerId: string; // The ID of the Courier

  @Column({ type: 'enum', enum: AccountType })
  accountType: AccountType;

  // We use numeric/decimal for currency to avoid floating-point errors
  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0.0 })
  balance: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
