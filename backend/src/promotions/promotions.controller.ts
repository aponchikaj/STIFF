import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CartService } from '../cart/cart.service';
import { newGuestId, readGuestId } from '../cart/cart-owner';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { ContentService } from '../content/content.service';
import {
  parseThresholdCents,
  shippingAfterThreshold,
} from '../orders/checkout.constants';
import {
  CreateDiscountDto,
  CreateGiftCardDto,
  QuoteDto,
  SetActiveDto,
  UpdateDiscountDto,
} from './dto/promotions.dto';
import { PromotionsService } from './promotions.service';

@Controller('promotions')
export class PromotionsController {
  constructor(
    private readonly promotionsService: PromotionsService,
    private readonly cartService: CartService,
    private readonly contentService: ContentService,
  ) {}

  /**
   * Prices the current cart with a code applied, without committing anything.
   *
   * Throttled harder than the default: this endpoint tells you whether a code
   * exists, so it is the obvious thing to point a script at.
   */
  @Public()
  @Post('quote')
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async quote(@Req() req: Request, @Body() dto: QuoteDto) {
    const user = (req as AuthenticatedRequest).user;
    const owner = user
      ? ({ kind: 'user', userId: user.id } as const)
      : ({ kind: 'guest', guestId: readGuestId(req) ?? newGuestId() } as const);

    const cart = await this.cartService.getCart(owner);
    // Same threshold checkout uses, so the quoted shipping is the real one.
    const storefront = await this.contentService.get('storefront');
    const shippingCents = shippingAfterThreshold(
      dto.shippingMethod,
      cart.subtotalCents,
      parseThresholdCents(
        storefront.value.freeShippingThresholdCents as string | undefined,
      ),
    );

    const { breakdown } = await this.promotionsService.quote({
      subtotalCents: cart.subtotalCents,
      shippingCents,
      discountCode: dto.discountCode,
      giftCardCode: dto.giftCardCode,
      redeemer: {
        userId: user?.id ?? null,
        email: user?.email ?? dto.email ?? null,
      },
    });
    return breakdown;
  }

  // ---------------------------------------------------------------- admin --

  @Get('discounts')
  @Roles('admin')
  listDiscounts(@Query() query: PaginationDto) {
    return this.promotionsService.listDiscounts(query);
  }

  @Post('discounts')
  @Roles('admin')
  createDiscount(@Body() dto: CreateDiscountDto) {
    return this.promotionsService.createDiscount(dto);
  }

  @Patch('discounts/:id')
  @Roles('admin')
  updateDiscount(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.promotionsService.updateDiscount(id, dto);
  }

  @Get('gift-cards')
  @Roles('admin')
  listGiftCards(@Query() query: PaginationDto) {
    return this.promotionsService.listGiftCards(query);
  }

  @Post('gift-cards')
  @Roles('admin')
  createGiftCard(@Body() dto: CreateGiftCardDto) {
    return this.promotionsService.createGiftCard(dto);
  }

  @Patch('gift-cards/:id')
  @Roles('admin')
  setGiftCardActive(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetActiveDto,
  ) {
    return this.promotionsService.setGiftCardActive(id, dto.isActive);
  }
}
