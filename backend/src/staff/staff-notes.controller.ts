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
import { CreateStaffNoteDto, UpdateStaffNoteDto } from './dto/staff-notes.dto';
import { StaffUser } from './entities/staff-user.entity';
import { StaffController } from './staff-area.decorator';
import { StaffNotesService } from './staff-notes.service';

@StaffController('notes')
export class StaffNotesController {
  constructor(private readonly staffNotesService: StaffNotesService) {}

  @Get()
  list(@CurrentStaff() user: StaffUser) {
    return this.staffNotesService.list(user);
  }

  @Post()
  create(@CurrentStaff() user: StaffUser, @Body() dto: CreateStaffNoteDto) {
    return this.staffNotesService.create(user, dto);
  }

  @Patch(':id')
  update(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffNoteDto,
  ) {
    return this.staffNotesService.update(user, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentStaff() user: StaffUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.staffNotesService.remove(user, id);
    return { success: true };
  }
}
