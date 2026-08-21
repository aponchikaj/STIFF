import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../common/types/paginated';
import { MailService } from '../mail/mail.service';
import { Subscriber, SubscriberStatus } from './subscriber.entity';

/**
 * The drop list, with double opt-in.
 *
 * The rule the whole class exists to keep: nothing is ever sent to an address
 * that has not confirmed, except the single confirmation itself. Anyone can
 * type anyone's address into a form on the internet, and this is what stops
 * that becoming a subscription — and what keeps the domain's sending
 * reputation out of the hands of whoever feels like abusing the form.
 */

/** Long enough that guessing one is not a strategy. */
const TOKEN_BYTES = 24;

/** A stale confirmation is re-sendable; an ancient one is not honoured. */
const CONFIRM_TTL_DAYS = 7;

/** How often the same address can ask for a fresh confirmation email. */
const RESEND_COOLDOWN_MS = 5 * 60 * 1000;

export interface SubscribeResult {
  /**
   * Deliberately the same shape whatever happened.
   *
   * "Already subscribed" and "we just emailed you" are different answers, and
   * telling them apart is how a signup form becomes a way to test whether an
   * address is on the list. The visitor is told to check their inbox either
   * way, which is also true either way.
   */
  status: 'check_your_inbox';
}

export interface SubscriberCounts {
  pending: number;
  confirmed: number;
  unsubscribed: number;
}

@Injectable()
export class SubscribersService {
  private readonly logger = new Logger(SubscribersService.name);

  constructor(
    @InjectRepository(Subscriber)
    private readonly subscriberRepo: Repository<Subscriber>,
    private readonly mailService: MailService,
  ) {}

  private token(): string {
    return randomBytes(TOKEN_BYTES).toString('hex');
  }

  private byEmail(email: string): Promise<Subscriber | null> {
    return this.subscriberRepo
      .createQueryBuilder('sub')
      .where('lower(sub."email") = lower(:email)', { email })
      .getOne();
  }

  /**
   * Ask to join the list.
   *
   * Idempotent, and silent about what it found. A new address gets a
   * confirmation; a pending one gets another (rate-limited); an unsubscribed
   * one is reopened as pending, because coming back is allowed and a previous
   * unsubscribe must not become a permanent ban nobody can lift; a confirmed
   * one is left completely alone.
   */
  async subscribe(email: string, source: string): Promise<SubscribeResult> {
    const existing = await this.byEmail(email);

    if (existing?.status === 'confirmed') {
      return { status: 'check_your_inbox' };
    }

    const now = new Date();
    const fresh =
      existing?.confirmSentAt &&
      now.getTime() - existing.confirmSentAt.getTime() < RESEND_COOLDOWN_MS;
    if (fresh) {
      // They asked again within a few minutes. The first email is still on its
      // way; sending a second one only makes the inbox worse.
      return { status: 'check_your_inbox' };
    }

    const confirmToken = this.token();
    const row =
      existing ??
      this.subscriberRepo.create({
        email,
        unsubscribeToken: this.token(),
      });

    row.email = email;
    row.status = 'pending';
    row.confirmToken = confirmToken;
    row.confirmSentAt = now;
    row.source = source;
    row.unsubscribedAt = null;
    if (!row.unsubscribeToken) row.unsubscribeToken = this.token();

    await this.subscriberRepo.save(row);
    await this.mailService.sendSubscribeConfirmation(email, confirmToken);

    return { status: 'check_your_inbox' };
  }

  /**
   * Click the link in the email.
   *
   * The token is cleared on success, so the same link cannot be replayed and a
   * forwarded confirmation cannot subscribe somebody twice. Confirming again
   * is not an error — people double-click — it simply reports the state.
   */
  async confirm(
    token: string,
  ): Promise<{ email: string; alreadyDone: boolean }> {
    const row = await this.subscriberRepo.findOne({
      where: { confirmToken: token },
    });

    if (!row) {
      // Either it was already used or it never existed. A confirmed address
      // that clicks its old link should be told it worked, not shown an error
      // — but we cannot find it from a cleared token, so this is the honest
      // answer for both.
      throw new NotFoundException(
        'That confirmation link has already been used or has expired.',
      );
    }

    const age = Date.now() - (row.confirmSentAt?.getTime() ?? 0);
    if (age > CONFIRM_TTL_DAYS * 86400_000) {
      throw new NotFoundException(
        'That confirmation link has expired. Sign up again and we will send a new one.',
      );
    }

    const alreadyDone = row.status === 'confirmed';
    row.status = 'confirmed';
    row.confirmedAt = row.confirmedAt ?? new Date();
    row.unsubscribedAt = null;
    row.confirmToken = null;
    await this.subscriberRepo.save(row);

    return { email: row.email, alreadyDone };
  }

  /**
   * Leave the list.
   *
   * The row is kept rather than deleted: a deleted address is one we would
   * happily email again the next time somebody types it into the form, and
   * "we already asked you not to" is the whole record worth keeping.
   */
  async unsubscribe(token: string): Promise<{ email: string }> {
    const row = await this.subscriberRepo.findOne({
      where: { unsubscribeToken: token },
    });
    if (!row) {
      throw new NotFoundException('That unsubscribe link is not valid.');
    }

    if (row.status !== 'unsubscribed') {
      row.status = 'unsubscribed';
      row.unsubscribedAt = new Date();
      row.confirmToken = null;
      await this.subscriberRepo.save(row);
    }
    return { email: row.email };
  }

  /**
   * Email every confirmed subscriber.
   *
   * Sequential rather than parallel: a burst of a few hundred sends at once is
   * how a provider decides you are a spammer, and this is not a job anybody is
   * waiting on. Failures are counted and logged rather than thrown, so one bad
   * address does not abandon the rest of the list halfway through.
   */
  async broadcast(
    title: string,
    body: string,
  ): Promise<{ sent: number; failed: number }> {
    const recipients = await this.confirmedEmails();
    let sent = 0;
    let failed = 0;

    for (const recipient of recipients) {
      try {
        await this.mailService.sendDropAlert(
          recipient.email,
          title,
          body,
          recipient.unsubscribeToken,
        );
        sent += 1;
      } catch (error) {
        failed += 1;
        this.logger.warn(
          `Drop alert to ${recipient.email} failed: ${
            error instanceof Error ? error.message : 'unknown'
          }`,
        );
      }
    }

    this.logger.log(`Drop alert "${title}": ${sent} sent, ${failed} failed`);
    return { sent, failed };
  }

  /** Everyone a broadcast may actually reach. */
  confirmedEmails(): Promise<Subscriber[]> {
    return this.subscriberRepo.find({
      where: { status: 'confirmed' },
      order: { confirmedAt: 'ASC' },
    });
  }

  async counts(): Promise<SubscriberCounts> {
    const rows = await this.subscriberRepo
      .createQueryBuilder('sub')
      .select('sub."status"', 'status')
      .addSelect('COUNT(*)::int', 'count')
      .groupBy('sub."status"')
      .getRawMany<{ status: SubscriberStatus; count: number }>();

    const counts: SubscriberCounts = {
      pending: 0,
      confirmed: 0,
      unsubscribed: 0,
    };
    for (const row of rows) counts[row.status] = row.count;
    return counts;
  }

  async list(
    page: number,
    pageSize: number,
    status?: SubscriberStatus,
  ): Promise<Paginated<Subscriber>> {
    const qb = this.subscriberRepo
      .createQueryBuilder('sub')
      .orderBy('sub."createdAt"', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize);
    if (status) qb.where('sub."status" = :status', { status });

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, page, pageSize);
  }

  /** Removes one row outright, for a deletion request rather than an opt-out. */
  async remove(id: string): Promise<void> {
    const result = await this.subscriberRepo.delete({ id });
    if (!result.affected) throw new NotFoundException('Subscriber not found');
  }
}
