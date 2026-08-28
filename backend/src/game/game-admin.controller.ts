import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DIFFICULTIES, type Difficulty } from '@stiff/game-core';
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
import { AudioDecodeService } from './audio-decode.service';
import { ChartPipelineService } from './chart-pipeline.service';
import { SectionPlanService } from './section-plan.service';

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
  constructor(
    private readonly admin: GameAdminService,
    private readonly pipeline: ChartPipelineService,
    private readonly decoder: AudioDecodeService,
    private readonly planner: SectionPlanService,
  ) {}

  /**
   * Whether the generation pipeline can run at all.
   *
   * The panel asks before offering an upload, so a missing ffmpeg is a
   * disabled button with an explanation rather than a failed job.
   */
  @Get('pipeline')
  async pipelineStatus() {
    return {
      ffmpeg: await this.decoder.available(),
      groq: this.planner.configured,
      model: this.planner.model,
    };
  }

  /**
   * Stage A. Expensive, and its answer is reused by all four difficulties, so
   * it runs once per song and is stored.
   */
  @Post('songs/:id/analyze')
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: 60 * 1024 * 1024 } }),
  )
  analyzeSong(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('No audio file');
    return this.pipeline.analyzeSong(id, file.buffer);
  }

  /** Stage B. Always lands as drafts; approval stays a human act. */
  @Post('songs/:id/generate')
  generate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { difficulties?: string[] },
  ) {
    const requested = body.difficulties?.filter((d): d is Difficulty =>
      (DIFFICULTIES as readonly string[]).includes(d),
    );
    return this.pipeline.generateCharts(
      id,
      requested?.length ? requested : undefined,
    );
  }

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
