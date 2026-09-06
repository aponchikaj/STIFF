import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SeasonStatus = 'draft' | 'open' | 'running' | 'closed';

/**
 * One three-day run of the game.
 *
 * Enrolment, role and hearts all hang off a season rather than off the account,
 * because a role is a per-season choice: someone who watched in season one may
 * play in season two, and the two facts must be able to coexist.
 *
 * `open` means enrolment is accepting people; `running` means the ladder has
 * started and nobody new may enrol. Both are visible to the front door, which
 * is why they are separate states rather than a boolean.
 */
@Entity('game_seasons')
export class GameSeason {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 60 })
  slug: string;

  @Column({ type: 'varchar', length: 120 })
  title: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 16,
    default: 'draft',
  })
  status: SeasonStatus;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  /** Hearts every player starts the season with — spec §12. */
  @Column({ type: 'int', default: 3 })
  startingHearts: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
