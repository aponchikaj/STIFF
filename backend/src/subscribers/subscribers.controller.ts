import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { SubscribeDto, SubscriberTokenDto } from './dto/subscriber.dto';
import type { SubscriberStatus } from './subscriber.entity';
import { SubscribersService } from './subscribers.service';

class BroadcastListDto {
  @IsString()
  @Length(1, 120)
  title: string;

  @IsString()
  @Length(1, 4000)
  body: string;
}

class ListSubscribersDto extends PaginationDto {
  @IsOptional()
  @IsIn(['pending', 'confirmed', 'unsubscribed'])
  status?: SubscriberStatus;
}

@Controller('subscribers')
export class SubscribersController {
  constructor(private readonly subscribers: SubscribersService) {}

  /**
   * Join the list.
   *
   * Throttled hard: this endpoint sends an email to an address the caller
   * chose, which is exactly the shape of thing that gets a domain blacklisted
   * if it is left open. The service also refuses to re-send to the same
   * address within a few minutes.
   */
  @Public()
  @Post()
  @HttpCode(200)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  subscribe(@Body() dto: SubscribeDto) {
    return this.subscribers.subscribe(dto.email, dto.source ?? 'home');
  }

  /** Both of these are reached from a link in an email, so both are public. */
  @Public()
  @Post('confirm')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  confirm(@Body() dto: SubscriberTokenDto) {
    return this.subscribers.confirm(dto.token);
  }

  @Public()
  @Post('unsubscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribe(@Body() dto: SubscriberTokenDto) {
    return this.subscribers.unsubscribe(dto.token);
  }

  // ---- admin ----
  //
  // `counts` is declared before nothing else here, but keeping literal paths
  // above any `:param` route is the habit that stops "counts" being read as an
  // id the day one is added.

  /**
   * Email the drop list.
   *
   * Confirmed addresses only — that is the whole promise of the double opt-in,
   * and it is enforced in the service rather than trusted to the caller.
   */
  @Post('broadcast')
  @Roles('admin')
  @HttpCode(200)
  broadcast(@Body() dto: BroadcastListDto) {
    return this.subscribers.broadcast(dto.title, dto.body);
  }

  @Get('counts')
  @Roles('admin')
  counts() {
    return this.subscribers.counts();
  }

  @Get()
  @Roles('admin')
  list(@Query() query: ListSubscribersDto) {
    return this.subscribers.list(query.page, query.pageSize, query.status);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.subscribers.remove(id);
    return { success: true };
  }
}
