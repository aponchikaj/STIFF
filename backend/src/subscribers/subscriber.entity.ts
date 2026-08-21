import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type SubscriberStatus = 'pending' | 'confirmed' | 'unsubscribed';

/**
 * Someone who asked to hear about a drop.
 *
 * Not a user. An account is a different relationship that happens to share an
 * address, and requiring one to receive an email is how a list stays small.
 */
@Entity('subscribers')
export class Subscriber {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 180 })
  email: string;

  /**
   * `pending` until the link in the confirmation email is clicked.
   *
   * Nothing is ever sent to a pending address except that one confirmation.
   * That is the whole of double opt-in: anyone can type someone else's address
   * into the form, and this is what stops that becoming a subscription.
   */
  @Column({ type: 'varchar', length: 20, default: 'pending' })
  status: SubscriberStatus;

  /** Cleared the moment it is used, so a forwarded link is inert. */
  @Column({ type: 'varchar', length: 64, nullable: true })
  confirmToken: string | null;

  @Column({ type: 'timestamp', nullable: true })
  confirmSentAt: Date | null;

  /**
   * Permanent, and in the footer of every send. One click and no login: an
   * unsubscribe behind a password is not an unsubscribe.
   */
  @Column({ type: 'varchar', length: 64 })
  unsubscribeToken: string;

  /** Where they signed up, so a form that is not working shows up as a zero. */
  @Column({ type: 'varchar', length: 40, default: 'home' })
  source: string;

  @Column({ type: 'timestamp', nullable: true })
  confirmedAt: Date | null;

  @Column({ type: 'timestamp', nullable: true })
  unsubscribedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
