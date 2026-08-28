import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { User } from '../../users/user.entity';

export type LedgerReason =
  | 'run_reward'
  | 'purchase'
  | 'refund'
  | 'admin_adjustment'
  | 'coin_pack'
  | 'seed_grant';

/**
 * Append-only. There is no balance column anywhere in this schema, and that is
 * the point: a wallet is `SUM(delta)` over these rows.
 *
 * A mutable balance is the shape that loses money to a retried request, and no
 * amount of care at the call site fixes it. Corrections are compensating
 * entries, which is also what keeps the mistake visible.
 *
 * Nothing updates or deletes a row here — note the absence of `@UpdateDateColumn`.
 */
@Entity('game_coin_ledger')
@Unique('UQ_game_coin_ledger_idempotency', ['idempotencyKey'])
@Index('IDX_game_coin_ledger_user', ['userId', 'createdAt'])
export class CoinLedgerEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column('uuid')
  userId: string;

  /** Signed: positive mints, negative spends. Never zero. */
  @Column({ type: 'int' })
  delta: number;

  @Column({ type: 'varchar', length: 32 })
  reason: LedgerReason;

  /** The run, purchase or admin action this entry accounts for. */
  @Column({ type: 'uuid', nullable: true })
  refId: string | null;

  /**
   * The safety net. Minting from a run uses the run id, so a double-submitted
   * run credits once; a purchase uses a client-supplied key, so a retried
   * checkout debits once.
   */
  @Column({ type: 'varchar', length: 160 })
  idempotencyKey: string;

  /** Required on an admin adjustment: coins appearing by hand need a why. */
  @Column({ type: 'text', nullable: true })
  note: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;
}
