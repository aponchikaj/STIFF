import {
  Body,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentStaff } from './current-staff.decorator';
import {
  CreateStaffTaskDto,
  ListStaffTasksQueryDto,
  UpdateStaffTaskDto,
} from './dto/staff-tasks.dto';
import { StaffUser } from './entities/staff-user.entity';
import { StaffController } from './staff-area.decorator';
import { StaffTasksService } from './staff-tasks.service';

@StaffController('tasks')
export class StaffTasksController {
  constructor(private readonly staffTasksService: StaffTasksService) {}

  @Get()
  list(
    @CurrentStaff() user: StaffUser,
    @Query() query: ListStaffTasksQueryDto,
  ) {
    return this.staffTasksService.list(user, query);
  }

  @Post()
  create(@CurrentStaff() user: StaffUser, @Body() dto: CreateStaffTaskDto) {
    return this.staffTasksService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffTaskDto,
  ) {
    return this.staffTasksService.update(user, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.staffTasksService.remove(user, id);
    return { success: true };
  }
}
