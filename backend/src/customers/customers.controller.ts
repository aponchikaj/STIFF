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
import { SaveAddressDto, SubscribeStockDto } from './dto/customers.dto';
import { StockAlertsService } from './stock-alerts.service';

@Controller()
export class CustomersController {
  constructor(
    private readonly addressesService: AddressesService,
    private readonly stockAlertsService: StockAlertsService,
    private readonly crossSellService: CrossSellService,
    private readonly cartService: CartService,
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
