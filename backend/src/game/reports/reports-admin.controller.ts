import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { User } from '../../users/user.entity';
import {
  ClaimReportDto,
  ListReportsQueryDto,
  ResolveReportDto,
  SetReportPriorityDto,
} from '../dto/reports.dto';
import { ReportsService } from './reports.service';

/**
 * `/api/game/admin/reports/*` — the queue.
 *
 * `@Roles('admin')` at the class level, like `GameAdminController`, which is
 * what lets an admin.stiff.ge session reach these. Every route here changes
 * something or reads what only the panel should, so the role is the whole
 * gate. Every state change lands in `admin_audit_logs` through the
 * interceptor the panel already has.
 */
@Controller('game/admin/reports')
@Roles('admin')
export class ReportsAdminController {
  constructor(private readonly reports: ReportsService) {}

  /** Counts, the oldest wait, and what is drawing the most fire. */
  @Get('stats')
  stats() {
    return this.reports.stats();
  }

  /** The queue by default; filter to anything. Most urgent, then oldest. */
  @Get()
  list(@Query() query: ListReportsQueryDto) {
    return this.reports.list(query);
  }

  /** One report, with the thing as it is now, its siblings, and both parties' history. */
  @Get(':id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.reports.get(id);
  }

  @Post(':id/claim')
  @HttpCode(200)
  async claim(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ClaimReportDto,
    @CurrentUser() admin: User,
  ) {
    return { report: await this.reports.claim(id, admin, dto) };
  }

  @Patch(':id/priority')
  async setPriority(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetReportPriorityDto,
  ) {
    return { report: await this.reports.setPriority(id, dto.priority) };
  }

  /** Closes it, performs the action, closes its siblings, tells the people. */
  @Post(':id/resolve')
  @HttpCode(200)
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReportDto,
    @CurrentUser() admin: User,
  ) {
    return this.reports.resolve(id, admin, dto);
  }

  @Post(':id/reopen')
  @HttpCode(200)
  async reopen(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() admin: User,
  ) {
    return { report: await this.reports.reopen(id, admin) };
  }
}
