import { Body, Controller, Get, Put, Query } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import type { User } from '../users/user.entity';
import { DeviceClassQuery, UpdateGameSettingsDto } from './dto/settings.dto';
import { GameSettingsService } from './game-settings.service';

/**
 * A player's calibration and preferences, per device class.
 *
 * Authenticated, not `@Public()`: these are per-account, and an anonymous
 * visitor has nowhere to store them. The client keeps a local copy for the
 * demo gate and uploads it once they sign in.
 */
@Controller('game/settings')
export class GameSettingsController {
  constructor(private readonly settings: GameSettingsService) {}

  @Get()
  get(@CurrentUser() user: User, @Query() query: DeviceClassQuery) {
    return this.settings.resolved(user.id, query.deviceClass);
  }

  @Put()
  update(@CurrentUser() user: User, @Body() dto: UpdateGameSettingsDto) {
    return this.settings.update(user.id, dto);
  }
}
