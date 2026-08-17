import { Body, Get, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { CurrentStaff } from './current-staff.decorator';
import {
  BlockStaffUserDto,
  ChangeStaffPasswordDto,
  ChangeStaffRoleDto,
  CreateStaffUserDto,
  UpdateStaffProfileDto,
} from './dto/staff-users.dto';
import { toSafeStaffUser, StaffUser } from './entities/staff-user.entity';
import { StaffController } from './staff-area.decorator';
import { StaffRoles } from './staff-roles.decorator';
import { StaffUsersService } from './staff-users.service';

@StaffController('people')
export class StaffUsersController {
  constructor(private readonly staffUsersService: StaffUsersService) {}

  @Get()
  list() {
    return this.staffUsersService.listDirectory();
  }

  @Post()
  @StaffRoles('owner', 'admin')
  async create(
    @CurrentStaff() actor: StaffUser,
    @Body() dto: CreateStaffUserDto,
  ) {
    const user = await this.staffUsersService.createAccount(actor, dto);
    return toSafeStaffUser(user);
  }

  @Patch('me')
  updateMe(
    @CurrentStaff() user: StaffUser,
    @Body() dto: UpdateStaffProfileDto,
  ) {
    return this.staffUsersService.updateProfile(user, dto);
  }

  @Patch('me/password')
  async changePassword(
    @CurrentStaff() user: StaffUser,
    @Body() dto: ChangeStaffPasswordDto,
  ) {
    await this.staffUsersService.changePassword(user, dto);
    return { success: true };
  }

  @Patch(':id/role')
  @StaffRoles('owner')
  changeRole(
    @CurrentStaff() actor: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeStaffRoleDto,
  ) {
    return this.staffUsersService.changeRole(actor, id, dto.role);
  }

  @Patch(':id/block')
  @StaffRoles('owner', 'admin')
  setBlocked(
    @CurrentStaff() actor: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BlockStaffUserDto,
  ) {
    return this.staffUsersService.setBlocked(actor, id, dto.blocked !== false);
  }
}
