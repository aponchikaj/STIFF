import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { StaffAuthController } from './staff-auth.controller';
import { StaffAuthService } from './staff-auth.service';
import { StaffChatController } from './staff-chat.controller';
import { StaffChatGateway } from './staff-chat.gateway';
import { StaffChatService } from './staff-chat.service';
import { StaffConversation } from './entities/staff-conversation.entity';
import { StaffConversationMember } from './entities/staff-conversation-member.entity';
import { StaffJwtGuard } from './staff-jwt.guard';
import { StaffMessage } from './entities/staff-message.entity';
import { StaffNote } from './entities/staff-note.entity';
import { StaffNotesController } from './staff-notes.controller';
import { StaffNotesService } from './staff-notes.service';
import { StaffRefreshToken } from './entities/staff-refresh-token.entity';
import { StaffRolesGuard } from './staff-roles.guard';
import { StaffSeedService } from './staff-seed.service';
import { StaffTask } from './entities/staff-task.entity';
import { StaffTasksController } from './staff-tasks.controller';
import { StaffTasksService } from './staff-tasks.service';
import { StaffTokenService } from './staff-token.service';
import { StaffUser } from './entities/staff-user.entity';
import { StaffUsersController } from './staff-users.controller';
import { StaffUsersService } from './staff-users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      StaffUser,
      StaffRefreshToken,
      StaffConversation,
      StaffConversationMember,
      StaffMessage,
      StaffTask,
      StaffNote,
    ]),
  ],
  controllers: [
    StaffAuthController,
    StaffUsersController,
    StaffChatController,
    StaffTasksController,
    StaffNotesController,
  ],
  providers: [
    StaffUsersService,
    StaffAuthService,
    StaffTokenService,
    StaffSeedService,
    StaffChatService,
    StaffChatGateway,
    StaffTasksService,
    StaffNotesService,
    StaffJwtGuard,
    StaffRolesGuard,
  ],
  exports: [StaffUsersService, StaffTokenService],
})
export class StaffModule {}
