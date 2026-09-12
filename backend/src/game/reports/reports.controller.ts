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
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { User } from '../../users/user.entity';
import { CreateReportDto, ListMyReportsQueryDto } from '../dto/reports.dto';
import { ReportsService } from './reports.service';

/**
 * `/api/game/reports/*` — saying something is wrong.
 *
 * The catalogue is public so the report sheet can be drawn before anyone
 * signs in; filing one needs a session, and only a session — a watcher who
 * never enrolled can still report a comment. There is no admin work here:
 * the queue is `ReportsAdminController`.
 */
@Controller('game/reports')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  /** What can be reported, for what. Rendered as the sheet's options. */
  @Public()
  @Get('reasons')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  reasons() {
    return this.reports.catalogue();
  }

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  create(@CurrentUser() user: User, @Body() dto: CreateReportDto) {
    return this.reports.create(user, dto);
  }

  @Get('mine')
  async mine(@CurrentUser() user: User, @Query() query: ListMyReportsQueryDto) {
    return { reports: await this.reports.mine(user, query.limit) };
  }

  /** Taken back, while it is still on the queue. */
  @Delete(':id')
  @HttpCode(200)
  async withdraw(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return { report: await this.reports.withdraw(user, id) };
  }
}
