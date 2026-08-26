import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Roles } from '../common/decorators/roles.decorator';
import { paginate, type Paginated } from '../common/types/paginated';
import { AdminAuditLog } from './entities/admin-audit-log.entity';
import { ListAuditDto } from './dto/list-audit.dto';

/**
 * Reads the admin trail. `@Roles('admin')`, which is also what makes it
 * reachable from an admin.stiff.ge session — see `JwtAuthGuard`.
 *
 * Read-only by design: there is no endpoint that edits or deletes an entry,
 * because a trail an admin can rewrite is not one.
 */
@Controller('admin/audit')
@Roles('admin')
export class AdminAuditController {
  constructor(
    @InjectRepository(AdminAuditLog)
    private readonly auditRepo: Repository<AdminAuditLog>,
  ) {}

  @Get()
  async list(@Query() query: ListAuditDto): Promise<Paginated<AdminAuditLog>> {
    const qb = this.auditRepo
      .createQueryBuilder('log')
      .orderBy('log.createdAt', 'DESC')
      .skip(query.skip)
      .take(query.pageSize);

    if (query.actorId) {
      qb.andWhere('log.actorId = :actorId', { actorId: query.actorId });
    }
    if (query.method) {
      qb.andWhere('log.method = :method', { method: query.method });
    }
    if (query.path) {
      qb.andWhere('log.path ILIKE :path', { path: `%${query.path}%` });
    }

    const [items, total] = await qb.getManyAndCount();
    return paginate(items, total, query.page, query.pageSize);
  }
}
