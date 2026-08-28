import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import type { User } from '../users/user.entity';
import { EquipDto, PurchaseDto } from './dto/shop.dto';
import { ShopService } from './shop.service';

@Controller('game')
export class ShopController {
  constructor(private readonly shop: ShopService) {}

  /** Browsable signed out — the shop is part of the pitch, not just the game. */
  @Get('items')
  @Public()
  items() {
    return this.shop.listItems();
  }

  @Get('wallet')
  wallet(@CurrentUser() user: User) {
    return this.shop.wallet(user.id);
  }

  @Get('inventory')
  inventory(@CurrentUser() user: User) {
    return this.shop.inventory(user.id);
  }

  /**
   * Idempotency-keyed, so a double tap on a slow connection buys one thing.
   * Rate-limited because it moves a balance.
   */
  @Post('purchase')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  purchase(@CurrentUser() user: User, @Body() dto: PurchaseDto) {
    return this.shop.purchase(user.id, dto.itemId, dto.idempotencyKey);
  }

  @Put('loadout')
  equip(@CurrentUser() user: User, @Body() dto: EquipDto) {
    return this.shop.equip(user.id, dto.slot, dto.itemId);
  }

  @Get('leaderboard/:chartId')
  @Public()
  leaderboard(@Param('chartId', ParseUUIDPipe) chartId: string) {
    return this.shop.leaderboard(chartId);
  }
}
