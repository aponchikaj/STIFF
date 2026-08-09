import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../users/user.entity';
import {
  BroadcastDto,
  ListNotificationsQueryDto,
} from './dto/notifications.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: User, @Query() query: ListNotificationsQueryDto) {
    return this.notificationsService.list(user.id, query);
  }

  // Must be declared before ':id/read' so 'read-all' doesn't match as an id.
  @Patch('read-all')
  async markAllRead(@CurrentUser() user: User) {
    const updated = await this.notificationsService.markAllRead(user.id);
    return { success: true, updated };
  }

  @Patch(':id/read')
  markRead(@CurrentUser() user: User, @Param('id', ParseUUIDPipe) id: string) {
    return this.notificationsService.markRead(user.id, id);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.notificationsService.remove(user.id, id);
    return { success: true };
  }

  @Post('broadcast')
  @Roles('admin')
  async broadcast(@Body() dto: BroadcastDto) {
    const sent = await this.notificationsService.broadcast(dto.title, dto.body);
    return { success: true, sent };
  }
}
