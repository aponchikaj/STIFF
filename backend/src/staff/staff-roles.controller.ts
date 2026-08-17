import {
  Body,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentStaff } from './current-staff.decorator';
import { CreateStaffRoleDto, UpdateStaffRoleDto } from './dto/staff-roles.dto';
import { StaffUser } from './entities/staff-user.entity';
import { StaffController } from './staff-area.decorator';
import { StaffPermissions } from './staff-permissions.decorator';
import { StaffRolesService } from './staff-roles.service';

@StaffController('roles')
export class StaffRolesController {
  constructor(private readonly staffRolesService: StaffRolesService) {}

  @Get('catalog')
  catalog() {
    return this.staffRolesService.catalog();
  }

  @Get()
  list() {
    return this.staffRolesService.list();
  }

  @Post()
  @StaffPermissions('roles.manage')
  create(@CurrentStaff() actor: StaffUser, @Body() dto: CreateStaffRoleDto) {
    return this.staffRolesService.create(actor, dto);
  }

  @Patch(':id')
  @StaffPermissions('roles.manage')
  update(
    @CurrentStaff() actor: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffRoleDto,
  ) {
    return this.staffRolesService.update(actor, id, dto);
  }

  @Delete(':id')
  @StaffPermissions('roles.manage')
  async remove(
    @CurrentStaff() actor: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.staffRolesService.remove(actor, id);
    return { success: true };
  }
}
