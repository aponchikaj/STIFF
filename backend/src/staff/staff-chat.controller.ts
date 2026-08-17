import { Body, Get, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { CurrentStaff } from './current-staff.decorator';
import {
  OpenDmDto,
  SendStaffMessageDto,
  StaffMessagesQueryDto,
} from './dto/staff-chat.dto';
import { StaffUser } from './entities/staff-user.entity';
import { StaffChatGateway } from './staff-chat.gateway';
import { StaffChatService } from './staff-chat.service';
import { StaffController } from './staff-area.decorator';

@StaffController('chat')
export class StaffChatController {
  constructor(
    private readonly staffChatService: StaffChatService,
    private readonly staffChatGateway: StaffChatGateway,
  ) {}

  @Get()
  list(@CurrentStaff() user: StaffUser) {
    return this.staffChatService.listConversations(user);
  }

  @Get('main')
  main(@CurrentStaff() user: StaffUser) {
    return this.staffChatService.getMain(user);
  }

  @Post('dm')
  openDm(@CurrentStaff() user: StaffUser, @Body() dto: OpenDmDto) {
    return this.staffChatService.openDm(user, dto.userId);
  }

  @Get(':id/messages')
  messages(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: StaffMessagesQueryDto,
  ) {
    return this.staffChatService.listMessages(user, id, query);
  }

  @Post(':id/messages')
  async send(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendStaffMessageDto,
  ) {
    const saved = await this.staffChatService.sendMessage(user, id, dto.body);
    this.staffChatGateway.emitMessage(id, saved);
    return saved;
  }

  @Post(':id/read')
  async read(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.staffChatService.markRead(user, id);
    return { success: true };
  }
}
