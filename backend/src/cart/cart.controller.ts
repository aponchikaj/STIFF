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
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { CartService } from './cart.service';
import {
  CartOwner,
  newGuestId,
  readGuestId,
  setGuestCookie,
} from './cart-owner';
import { AddCartItemDto, UpdateCartItemDto } from './dto/cart.dto';

/**
 * Public on purpose. `JwtAuthGuard` still attaches `req.user` on public routes
 * when a valid token is present, so a signed-in visitor gets their own cart and
 * everyone else gets one keyed to the `stiff_cart` cookie.
 */
@Public()
@Controller('cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  getCart(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    return this.cartService.getCart(this.owner(req, res, false));
  }

  @Post('items')
  addItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(this.owner(req, res, true), dto);
  }

  @Patch('items/:id')
  updateItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.updateItem(this.owner(req, res, false), id, dto);
  }

  @Delete('items/:id')
  removeItem(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.cartService.removeItem(this.owner(req, res, false), id);
  }

  @Delete()
  async clear(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.cartService.clear(this.owner(req, res, false));
    return { success: true };
  }

  /**
   * `mint` is true only where a cart is actually being created. Reading an
   * empty cart should not hand every crawler a cookie, and updating or deleting
   * an item without one is a 404 anyway.
   */
  private owner(req: Request, res: Response, mint: boolean): CartOwner {
    const user = (req as AuthenticatedRequest).user;
    if (user) return { kind: 'user', userId: user.id };

    const existing = readGuestId(req);
    if (existing) return { kind: 'guest', guestId: existing };

    const guestId = mint ? newGuestId() : '';
    if (mint) setGuestCookie(res, guestId);
    return { kind: 'guest', guestId };
  }
}
