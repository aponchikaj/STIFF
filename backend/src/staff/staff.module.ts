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
import { StaffPermissionsGuard } from './staff-permissions.guard';
import { StaffRefreshToken } from './entities/staff-refresh-token.entity';
import { StaffRole } from './entities/staff-role.entity';
import { StaffRolesController } from './staff-roles.controller';
import { StaffRolesService } from './staff-roles.service';
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
      StaffRole,
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
    StaffRolesController,
    StaffChatController,
    StaffTasksController,
    StaffNotesController,
  ],
  providers: [
    StaffUsersService,
    StaffRolesService,
    StaffAuthService,
    StaffTokenService,
    StaffSeedService,
    StaffChatService,
    StaffChatGateway,
    StaffTasksService,
    StaffNotesService,
    StaffJwtGuard,
    StaffPermissionsGuard,
  ],
  exports: [StaffUsersService, StaffTokenService],
})
export class StaffModule {}
