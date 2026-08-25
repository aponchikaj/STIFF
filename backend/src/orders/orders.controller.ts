import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  clearGuestCookie,
  newGuestId,
  readGuestId,
  setGuestCookie,
} from '../cart/cart-owner';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { VerifiedOrGuestGuard } from '../common/guards/verified-or-guest.guard';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import {
  BuyNowDto,
  CheckoutDto,
  ListOrdersQueryDto,
  UpdateOrderDateDto,
  UpdateOrderStatusDto,
  UpdateTrackingDto,
} from './dto/orders.dto';
import { ContentService } from '../content/content.service';
import { parseCancellableStatuses } from './cancellation';
import { Buyer, OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(
    private readonly ordersService: OrdersService,
    private readonly contentService: ContentService,
  ) {}

  @Public()
  @Post('checkout')
  @UseGuards(VerifiedOrGuestGuard)
  async checkout(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: CheckoutDto,
  ) {
    const buyer = this.buyer(req, dto.email);
    const order = await this.ordersService.checkout(buyer, dto);
    // The cart it was built from is gone, so the cookie has nothing left to
    // point at. A fresh one is minted the next time something is added.
    if (buyer.kind === 'guest') clearGuestCookie(res);
    return order;
  }

  @Public()
  @Post('buy-now')
  @UseGuards(VerifiedOrGuestGuard)
  buyNow(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: BuyNowDto,
  ) {
    // Buy-now never touches the cart, so a guest without a cookie still needs
    // an identity for the duration of the call.
    const buyer = this.buyer(req, dto.email, res);
    return this.ordersService.buyNow(buyer, dto);
  }

  /** Signed-in buyer, or a guest identified by cart cookie + typed email. */
  private buyer(
    req: Request,
    email: string | undefined,
    res?: Response,
  ): Buyer {
    const user = (req as AuthenticatedRequest).user;
    if (user) return { kind: 'user', user };

    const trimmed = email?.trim();
    if (!trimmed) {
      throw new BadRequestException(
        'Enter an email so we can send your order confirmation.',
      );
    }

    let guestId = readGuestId(req);
    if (!guestId) {
      guestId = newGuestId();
      if (res) setGuestCookie(res, guestId);
    }
    return { kind: 'guest', guestId, email: trimmed };
  }

  @Get()
  @Roles('admin')
  adminList(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.adminList(query);
  }

  /**
   * Public so a guest can see their receipt.
   *
   * The order id is a v4 uuid — unguessable and not enumerable — and that is
   * the only key a guest has, exactly like the order-status links every other
   * shop sends. A signed-in visitor is still held to owning the order.
   */
  @Public()
  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = (req as AuthenticatedRequest).user ?? null;
    return this.ordersService.getOne(id, user);
  }

  /**
   * Customer cancellation. Public for the same reason the receipt is: a guest
   * holds only the order id, and `getOne` still refuses an account order to an
   * anonymous caller.
   */
  @Public()
  @Post(':id/cancel')
  async cancel(@Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    const user = (req as AuthenticatedRequest).user ?? null;
    const content = await this.contentService.get('storefront');
    const cancellable = parseCancellableStatuses(
      content.value.cancelWindowStatuses as string | undefined,
    );
    return this.ordersService.cancelByCustomer(id, user, cancellable);
  }

  @Patch(':id/tracking')
  @Roles('admin')
  setTracking(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTrackingDto,
  ) {
    return this.ordersService.setTracking(id, dto);
  }

  @Patch(':id/status')
  @Roles('admin')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }

  @Patch(':id/date')
  @Roles('admin')
  updateDate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderDateDto,
  ) {
    return this.ordersService.setDate(id, dto.date);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.ordersService.remove(id);
    return { success: true };
  }
}
