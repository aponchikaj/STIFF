import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { newGuestId, readGuestId } from '../cart/cart-owner';
import { CartService } from '../cart/cart.service';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { GEORGIA_REGIONS } from '../orders/georgia';
import { User } from '../users/user.entity';
import { AddressesService } from './addresses.service';
import { CrossSellService } from './cross-sell.service';
import {
  MergeWishlistDto,
  SaveAddressDto,
  SubscribeStockDto,
} from './dto/customers.dto';
import { StockAlertsService } from './stock-alerts.service';
import { WishlistService } from './wishlist.service';

@Controller()
export class CustomersController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly stockAlertsService: StockAlertsService,
    private readonly crossSellService: CrossSellService,
    private readonly cartService: CartService,
    private readonly wishlistService: WishlistService,
  ) {}

  // ------------------------------------------------------------ addresses --

  @Get('addresses')
  list(@CurrentUser() user: User) {
    return this.addressesService.list(user.id);
  }

  @Post('addresses')
  create(@CurrentUser() user: User, @Body() dto: SaveAddressDto) {
    return this.addressesService.create(user.id, dto);
  }

  @Patch('addresses/:id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAddressDto,
  ) {
    return this.addressesService.update(user.id, id, dto);
  }

  @Delete('addresses/:id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.addressesService.remove(user.id, id);
    return { success: true };
  }

  /** The regions the checkout dropdown offers. */
  @Public()
  @Get('addresses/regions')
  regions() {
    return { regions: GEORGIA_REGIONS };
  }

  // --------------------------------------------------------- stock alerts --

  /**
   * Public so someone can ask to be told without making an account — which is
   * the point, since they cannot buy the thing yet either.
   */
  @Public()
  @Post('stock-alerts')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  subscribe(@Req() req: Request, @Body() dto: SubscribeStockDto) {
    const user = (req as AuthenticatedRequest).user;
    return this.stockAlertsService.subscribe(dto, {
      userId: user?.id ?? null,
      email: user ? null : (dto.email ?? null),
    });
  }

  // -------------------------------------------------------------- wishlist --

  /**
   * Saved pieces. Private by design — a like is the public signal, this is
   * not, so there is no route that reads someone else's.
   */
  @Get('wishlist')
  wishlist(@CurrentUser() user: User) {
    return this.wishlistService.list(user.id);
  }

  /** Just the ids, so a grid can fill every heart without a request per card. */
  @Get('wishlist/ids')
  async wishlistIds(@CurrentUser() user: User) {
    return { productIds: await this.wishlistService.idsFor(user.id) };
  }

  /**
   * Folds a signed-out list into this account.
   *
   * Same bargain as the guest cart: saving should not require an account, and
   * making one later should not lose what was saved.
   */
  @Post('wishlist/merge')
  async mergeWishlist(
    @CurrentUser() user: User,
    @Body() dto: MergeWishlistDto,
  ) {
    return {
      productIds: await this.wishlistService.merge(user.id, dto.productIds),
    };
  }

  /** Declared after `merge` on purpose: a literal path must win over `:productId`. */
  @Post('wishlist/:productId')
  toggleWishlist(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    return this.wishlistService.toggle(user.id, productId);
  }

  @Delete('wishlist/:productId')
  async unsave(
    @CurrentUser() user: User,
    @Param('productId', ParseUUIDPipe) productId: string,
  ) {
    await this.wishlistService.remove(user.id, productId);
    return { success: true };
  }

  // ------------------------------------------------------------ cross-sell --

  @Public()
  @Get('cross-sell')
  async crossSell(@Req() req: Request) {
    const user = (req as AuthenticatedRequest).user;
    const owner = user
      ? ({ kind: 'user', userId: user.id } as const)
      : ({ kind: 'guest', guestId: readGuestId(req) ?? newGuestId() } as const);
    const cart = await this.cartService.getCart(owner);
    const products = await this.crossSellService.suggestFor(
      cart.items.map((item) => item.productId),
    );
    return { products };
  }
}
