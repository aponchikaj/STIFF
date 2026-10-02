import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { User } from '../users/user.entity';
import { ShopService } from './shop.service';

/**
 * `/api/game/shop/*` — spend coins.
 *
 * The list is public so the shop is a reason to want an account; buying
 * needs a session and an enrolment of either side. Players and watchers
 * hold coins alike.
 */
@Controller('game/shop')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list(@Req() req: Request) {
    const user = (req as AuthenticatedRequest).user ?? null;
    return { items: await this.shop.list(user) };
  }

  @Post(':id/buy')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async buy(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return { purchase: await this.shop.buy(user, id) };
  }

  @Get('purchases/mine')
  async mine(@CurrentUser() user: User) {
    return { purchases: await this.shop.mine(user) };
  }
}
