import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Paginated, paginate } from '../common/types/paginated';
import { PaginationDto } from '../common/dto/pagination.dto';
import { DiscountCode } from './discount-code.entity';
import { DiscountRedemption } from './discount-redemption.entity';
import { GiftCardLedgerEntry } from './gift-card-ledger.entity';
import { GiftCard } from './gift-card.entity';
import {
  CODE_PROBLEM_MESSAGES,
  DiscountRule,
  PriceBreakdown,
  normalizeCode,
  priceOrder,
  usageProblem,
  windowProblem,
} from './pricing';
import {
  CreateDiscountDto,
  CreateGiftCardDto,
  UpdateDiscountDto,
} from './dto/promotions.dto';

/** Who is redeeming — a guest is identified by the email they check out with. */
export interface Redeemer {
  userId: string | null;
  email: string | null;
}

export interface ResolvedPromotions {
  discount: { code: DiscountCode; rule: DiscountRule } | null;
  giftCard: GiftCard | null;
}

@Injectable()
export class PromotionsService {
  constructor(
    @InjectRepository(DiscountCode)
    private readonly discountRepo: Repository<DiscountCode>,
    @InjectRepository(DiscountRedemption)
    private readonly redemptionRepo: Repository<DiscountRedemption>,
    @InjectRepository(GiftCard)
    private readonly giftCardRepo: Repository<GiftCard>,
  ) {}

  // ------------------------------------------------------------ resolving --

  /**
   * Looks a discount code up and checks it may be used by this buyer now.
   *
   * Throws with the specific reason rather than a generic "invalid code":
   * "you have already used that" and "that expired" send someone to very
   * different next actions.
   */
  async resolveDiscount(
    rawCode: string,
    redeemer: Redeemer,
    subtotalCents: number,
  ): Promise<{ code: DiscountCode; rule: DiscountRule }> {
    const code = normalizeCode(rawCode);
    const found = await this.discountRepo
      .createQueryBuilder('code')
      .where('upper(code.code) = :code', { code })
      .getOne();
    if (!found) throw new BadRequestException('That code does not exist.');

    const window = windowProblem(found);
    if (window) throw new BadRequestException(CODE_PROBLEM_MESSAGES[window]);

    const usedByThisBuyer = await this.countRedemptions(found.id, redeemer);
    const usage = usageProblem({
      usedCount: found.usedCount,
      usageLimit: found.usageLimit,
      perUserLimit: found.perUserLimit,
      usedByThisBuyer,
    });
    if (usage) throw new BadRequestException(CODE_PROBLEM_MESSAGES[usage]);

    if (subtotalCents < found.minSubtotalCents) {
      throw new BadRequestException(
        `That code needs a subtotal of at least ${(found.minSubtotalCents / 100).toFixed(2)} GEL.`,
      );
    }

    return {
      code: found,
      rule: {
        kind: found.kind,
        value: found.value,
        minSubtotalCents: found.minSubtotalCents,
      },
    };
  }

  async resolveGiftCard(rawCode: string): Promise<GiftCard> {
    const code = normalizeCode(rawCode);
    const found = await this.giftCardRepo
      .createQueryBuilder('card')
      .where('upper(card.code) = :code', { code })
      .getOne();
    if (!found) throw new BadRequestException('That gift card does not exist.');

    const window = windowProblem(found);
    if (window) throw new BadRequestException(CODE_PROBLEM_MESSAGES[window]);
    if (found.remainingCents <= 0) {
      throw new BadRequestException(CODE_PROBLEM_MESSAGES.empty);
    }
    return found;
  }

  /**
   * Both codes plus the arithmetic, in one call.
   *
   * The cart preview and checkout both go through here so they cannot drift —
   * quoting one total and charging another is the failure this exists to
   * prevent.
   */
  async quote(params: {
    subtotalCents: number;
    shippingCents: number;
    discountCode?: string | null;
    giftCardCode?: string | null;
    redeemer: Redeemer;
  }): Promise<{ breakdown: PriceBreakdown; resolved: ResolvedPromotions }> {
    const discount = params.discountCode
      ? await this.resolveDiscount(
          params.discountCode,
          params.redeemer,
          params.subtotalCents,
        )
      : null;
    const giftCard = params.giftCardCode
      ? await this.resolveGiftCard(params.giftCardCode)
      : null;

    const breakdown = priceOrder({
      subtotalCents: params.subtotalCents,
      shippingCents: params.shippingCents,
      discount: discount?.rule ?? null,
      giftCardBalanceCents: giftCard?.remainingCents ?? 0,
    });

    return { breakdown, resolved: { discount, giftCard } };
  }

  private async countRedemptions(
    codeId: string,
    redeemer: Redeemer,
  ): Promise<number> {
    if (redeemer.userId) {
      return this.redemptionRepo.count({
        where: { codeId, userId: redeemer.userId },
      });
    }
    if (redeemer.email) {
      return this.redemptionRepo.count({
        where: { codeId, guestEmail: redeemer.email.toLowerCase() },
      });
    }
    return 0;
  }

  // ------------------------------------------------------------ committing --

  /**
   * Records the use and takes the money off the card.
   *
   * Runs inside the checkout transaction. The gift card debit carries its own
   * guard in the WHERE clause for the same reason stock does: two orders
   * spending the last of one balance must not both succeed.
   */
  async commit(
    manager: EntityManager,
    params: {
      orderId: string;
      redeemer: Redeemer;
      resolved: ResolvedPromotions;
      breakdown: PriceBreakdown;
    },
  ): Promise<void> {
    const { discount, giftCard } = params.resolved;

    if (discount && params.breakdown.discountCents >= 0) {
      await manager.save(
        manager.create(DiscountRedemption, {
          codeId: discount.code.id,
          orderId: params.orderId,
          userId: params.redeemer.userId,
          guestEmail: params.redeemer.email?.toLowerCase() ?? null,
          amountCents: params.breakdown.discountCents,
        }),
      );
      await manager.increment(
        DiscountCode,
        { id: discount.code.id },
        'usedCount',
        1,
      );
    }

    const spend = params.breakdown.giftCardCents;
    if (giftCard && spend > 0) {
      const rows = await manager.query<unknown[]>(
        `UPDATE "gift_cards"
           SET "remainingCents" = "remainingCents" - $2, "updatedAt" = now()
         WHERE "id" = $1 AND "remainingCents" >= $2 AND "isActive" = true
         RETURNING "id"`,
        [giftCard.id, spend],
      );
      if (!Array.isArray(rows) || rows.length === 0) {
        throw new BadRequestException(
          'That gift card no longer has enough balance.',
        );
      }
      await manager.save(
        manager.create(GiftCardLedgerEntry, {
          giftCardId: giftCard.id,
          orderId: params.orderId,
          amountCents: -spend,
          reason: 'spend',
        }),
      );
    }
  }

  /** Puts a gift card spend back when an order is cancelled or refunded. */
  async refundGiftCard(
    manager: EntityManager,
    orderId: string,
    code: string,
    amountCents: number,
  ): Promise<void> {
    if (amountCents <= 0) return;
    const card = await manager
      .getRepository(GiftCard)
      .createQueryBuilder('card')
      .where('upper(card.code) = :code', { code: normalizeCode(code) })
      .getOne();
    if (!card) return;

    // Capped at what was issued, so a double refund cannot mint balance.
    await manager.query(
      `UPDATE "gift_cards"
         SET "remainingCents" = LEAST("remainingCents" + $2, "initialCents"),
             "updatedAt" = now()
       WHERE "id" = $1`,
      [card.id, amountCents],
    );
    await manager.save(
      manager.create(GiftCardLedgerEntry, {
        giftCardId: card.id,
        orderId,
        amountCents,
        reason: 'refund',
      }),
    );
  }

  // ---------------------------------------------------------------- admin --

  listDiscounts(query: PaginationDto): Promise<Paginated<DiscountCode>> {
    return this.discountRepo
      .findAndCount({
        order: { createdAt: 'DESC' },
        skip: query.skip,
        take: query.pageSize,
      })
      .then(([items, total]) =>
        paginate(items, total, query.page, query.pageSize),
      );
  }

  async createDiscount(dto: CreateDiscountDto): Promise<DiscountCode> {
    const code = normalizeCode(dto.code);
    if (!code) throw new BadRequestException('Give the code a name.');
    const clash = await this.discountRepo
      .createQueryBuilder('code')
      .where('upper(code.code) = :code', { code })
      .getOne();
    if (clash) throw new BadRequestException('That code already exists.');

    return this.discountRepo.save(
      this.discountRepo.create({
        code,
        kind: dto.kind,
        value: dto.kind === 'free_shipping' ? 0 : dto.value,
        minSubtotalCents: dto.minSubtotalCents ?? 0,
        usageLimit: dto.usageLimit ?? null,
        perUserLimit: dto.perUserLimit ?? null,
        startsAt: dto.startsAt ? new Date(dto.startsAt) : null,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        note: dto.note ?? '',
      }),
    );
  }

  async updateDiscount(
    id: string,
    dto: UpdateDiscountDto,
  ): Promise<DiscountCode> {
    const code = await this.discountRepo.findOne({ where: { id } });
    if (!code) throw new BadRequestException('That code does not exist.');
    if (dto.isActive !== undefined) code.isActive = dto.isActive;
    if (dto.usageLimit !== undefined) code.usageLimit = dto.usageLimit ?? null;
    if (dto.perUserLimit !== undefined) {
      code.perUserLimit = dto.perUserLimit ?? null;
    }
    if (dto.expiresAt !== undefined) {
      code.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    }
    if (dto.note !== undefined) code.note = dto.note;
    return this.discountRepo.save(code);
  }

  listGiftCards(query: PaginationDto): Promise<Paginated<GiftCard>> {
    return this.giftCardRepo
      .findAndCount({
        order: { createdAt: 'DESC' },
        skip: query.skip,
        take: query.pageSize,
      })
      .then(([items, total]) =>
        paginate(items, total, query.page, query.pageSize),
      );
  }

  async createGiftCard(dto: CreateGiftCardDto): Promise<GiftCard> {
    const code = dto.code ? normalizeCode(dto.code) : generateGiftCode();
    const clash = await this.giftCardRepo
      .createQueryBuilder('card')
      .where('upper(card.code) = :code', { code })
      .getOne();
    if (clash) throw new BadRequestException('That gift card already exists.');

    return this.giftCardRepo.save(
      this.giftCardRepo.create({
        code,
        initialCents: dto.initialCents,
        remainingCents: dto.initialCents,
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        note: dto.note ?? '',
      }),
    );
  }

  async setGiftCardActive(id: string, isActive: boolean): Promise<GiftCard> {
    const card = await this.giftCardRepo.findOne({ where: { id } });
    if (!card) throw new BadRequestException('That gift card does not exist.');
    card.isActive = isActive;
    return this.giftCardRepo.save(card);
  }
}

/**
 * Human-transcribable: no vowels (so no accidental words), and no 0/O/1/I,
 * which are the pairs people mistype when reading a card aloud.
 */
const GIFT_ALPHABET = 'BCDFGHJKLMNPQRSTVWXYZ23456789';

function generateGiftCode(): string {
  const pick = () =>
    Array.from(
      { length: 4 },
      () => GIFT_ALPHABET[Math.floor(Math.random() * GIFT_ALPHABET.length)],
    ).join('');
  return `GIFT-${pick()}-${pick()}`;
}
