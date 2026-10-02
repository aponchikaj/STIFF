import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { User } from '../users/user.entity';
import { OpalCheckoutDto } from './dto/opals.dto';
import { OpalsService } from './opals.service';

/**
 * `/api/game/opals/*` — buy opals with money.
 *
 * The price list and the card methods are public, like the coin shop's
 * list: what things cost is a reason to want an account. Buying needs a
 * session and an enrolment of either side, because the opals land on a
 * season balance.
 *
 * There is no callback route here yet. In `PAYMENTS_TEST_MODE` the card
 * providers settle at checkout; the live acquirer's signed callback will
 * call `OpalsService.settle` once that integration exists, the same way
 * the shop's orders will.
 */
@Controller('game/opals')
export class OpalsController {
  constructor(private readonly opals: OpalsService) {}

  @Public()
  @Get()
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  async list() {
    return {
      packs: await this.opals.listPacks(),
      methods: this.opals.methods(),
    };
  }

  @Post('checkout')
  @HttpCode(200)
  // Tight: every call writes an order and may contact an acquirer.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  checkout(@CurrentUser() user: User, @Body() dto: OpalCheckoutDto) {
    return this.opals.checkout(user, dto.packId, dto.method);
  }

  @Get('orders/mine')
  async mine(@CurrentUser() user: User) {
    return { orders: await this.opals.mine(user) };
  }
}
