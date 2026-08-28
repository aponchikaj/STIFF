import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { User } from '../users/user.entity';
import {
  AdjustCoinsDto,
  GrantItemDto,
  RemoveEntryDto,
  ReviewRejectionDto,
  WriteConfigDto,
} from './dto/game-admin.dto';
import { GameAdminService } from './game-admin.service';

/**
 * The panel's game operations.
 *
 * Under `@Roles('admin')` on the shop's own controller rather than in
 * `backend/src/admin/`, which is the convention the rest of the panel follows:
 * one implementation of "approve a chart", and the existing audit interceptor
 * records every call here with before/after state without being asked.
 */
@Controller('game/admin')
@Roles('admin')
export class GameAdminController {
  constructor(private readonly admin: GameAdminService) {}

  @Get('overview')
  overview() {
    return this.admin.overview();
  }

  @Get('charts')
  charts() {
    return this.admin.listCharts();
  }

  @Post('charts/:id/approve')
  approve(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.admin.approveChart(id, user.id);
  }

  @Post('charts/:id/archive')
  archive(@Param('id', ParseUUIDPipe) id: string) {
    return this.admin.archiveChart(id);
  }

  @Get('rejections')
  rejections(@Query('reviewed') reviewed?: string) {
    return this.admin.listRejections(reviewed === 'true');
  }

  @Post('rejections/:id/review')
  review(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewRejectionDto,
  ) {
    return this.admin.reviewRejection(id, user.id, dto.action);
  }

  @Post('leaderboard/:id/remove')
  removeEntry(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RemoveEntryDto,
  ) {
    return this.admin.removeLeaderboardEntry(id, user.id, dto.reason);
  }

  @Post('users/:id/coins')
  adjustCoins(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AdjustCoinsDto,
  ) {
    return this.admin.adjustCoins(id, user.id, dto.delta, dto.note);
  }

  @Post('users/:id/grant')
  grant(@Param('id', ParseUUIDPipe) id: string, @Body() dto: GrantItemDto) {
    return this.admin.grantItem(id, dto.itemId);
  }

  @Get('economy')
  economy() {
    return this.admin.readConfig();
  }

  @Put('economy')
  writeEconomy(@CurrentUser() user: User, @Body() dto: WriteConfigDto) {
    return this.admin.writeConfig(dto.key, dto.value, user.id);
  }
}
