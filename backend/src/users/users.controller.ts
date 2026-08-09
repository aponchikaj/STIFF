import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationDto } from '../common/dto/pagination.dto';
import { User } from './user.entity';
import {
  BlockUserDto,
  ChangePasswordDto,
  ChangeRoleDto,
  ListUsersQueryDto,
  MyReactionsQueryDto,
  UpdateProfileDto,
  UpdateSettingsDto,
} from './dto/users.dto';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // ---------- profile (must be declared before /users/:id) ----------

  @Get('me/stats')
  getStats(@CurrentUser() user: User) {
    return this.usersService.getStats(user);
  }

  @Get('me/orders')
  getMyOrders(@CurrentUser() user: User, @Query() query: PaginationDto) {
    return this.usersService.getMyOrders(user.id, query);
  }

  @Get('me/comments')
  getMyComments(@CurrentUser() user: User, @Query() query: PaginationDto) {
    return this.usersService.getMyComments(user.id, query);
  }

  @Get('me/reactions')
  getMyReactions(
    @CurrentUser() user: User,
    @Query() query: MyReactionsQueryDto,
  ) {
    return this.usersService.getMyReactions(user.id, query);
  }

  @Get('me/settings')
  getSettings(@CurrentUser() user: User) {
    return this.usersService.getSettings(user);
  }

  @Patch('me/settings')
  updateSettings(@CurrentUser() user: User, @Body() dto: UpdateSettingsDto) {
    return this.usersService.updateSettings(user, { ...dto });
  }

  @Patch('me')
  updateProfile(@CurrentUser() user: User, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user, dto);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentUser() user: User,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user, dto);
    return { success: true };
  }

  // ---------- admin ----------

  @Get()
  @Roles('admin')
  list(@Query() query: ListUsersQueryDto) {
    return this.usersService.adminList(query);
  }

  @Get(':id')
  @Roles('admin')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.adminGet(id);
  }

  @Patch(':id/block')
  @Roles('admin')
  setBlocked(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockUserDto,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.adminSetBlocked(id, dto.blocked, admin);
  }

  @Patch(':id/role')
  @Roles('admin')
  setRole(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeRoleDto,
    @CurrentUser() admin: User,
  ) {
    return this.usersService.adminSetRole(id, dto.role, admin);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
  ) {
    await this.usersService.adminDelete(id, admin);
    return { success: true };
  }
}
