import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Account } from './account.entity';

@Entity('ledger_entries')
export class LedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid' })
  transactionId: string; // Groups double-entry records together

  @ManyToOne(() => Account)
  @JoinColumn({ name: 'accountId' })
  account: Account;

  @Column({ type: 'uuid' })
  accountId: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number; // Positive for Credit, Negative for Debit

  @Column({ type: 'varchar', length: 100 })
  description: string;

  @CreateDateColumn()
  createdAt: Date;
}
