import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateStaffTaskDto,
  ListStaffTasksQueryDto,
  UpdateStaffTaskDto,
} from './dto/staff-tasks.dto';
import { StaffTask } from './entities/staff-task.entity';
import { StaffUser } from './entities/staff-user.entity';
import {
  canAssignTaskTo,
  canDeleteTask,
  canEditTask,
  canViewOthersBoards,
} from './permissions';
import type { StaffTaskStatus } from './staff.constants';
import { StaffUsersService } from './staff-users.service';

export interface StaffTaskView {
  id: string;
  title: string;
  description: string;
  status: StaffTaskStatus;
  position: number;
  assigneeId: string;
  assigneeUsername: string;
  createdById: string | null;
  dueDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StaffTasksService {
  constructor(
    @InjectRepository(StaffTask)
    private readonly taskRepo: Repository<StaffTask>,
    private readonly staffUsersService: StaffUsersService,
  ) {}

  async list(
    actor: StaffUser,
    query: ListStaffTasksQueryDto,
  ): Promise<StaffTaskView[]> {
    const assigneeId = canViewOthersBoards(actor)
      ? (query.assigneeId ?? actor.id)
      : actor.id;

    const where: { assigneeId: string; status?: StaffTaskStatus } = {
      assigneeId,
    };
    if (query.status) where.status = query.status;

    const rows = await this.taskRepo.find({
      where,
      relations: { assignee: true },
      order: { position: 'ASC', createdAt: 'ASC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    actor: StaffUser,
    dto: CreateStaffTaskDto,
  ): Promise<StaffTaskView> {
    const assigneeId = dto.assigneeId ?? actor.id;
    if (!canAssignTaskTo(actor, assigneeId)) {
      throw new ForbiddenException('You can only create tasks for yourself');
    }
    const assignee = await this.staffUsersService.findById(assigneeId);
    if (!assignee) throw new NotFoundException('Assignee not found');

    const status = dto.status ?? 'todo';
    const position = await this.nextPosition(assigneeId, status);
    const task = await this.taskRepo.save(
      this.taskRepo.create({
        title: dto.title.trim(),
        description: dto.description?.trim() ?? '',
        status,
        position,
        assigneeId,
        createdById: actor.id,
        dueDate: dto.dueDate ?? null,
      }),
    );
    task.assignee = assignee;
    return this.toView(task);
  }

  async update(
    actor: StaffUser,
    id: string,
    dto: UpdateStaffTaskDto,
  ): Promise<StaffTaskView> {
    const task = await this.requireTask(id);
    if (!canEditTask(actor, task)) {
      throw new ForbiddenException('You cannot edit this task');
    }

    if (dto.assigneeId && dto.assigneeId !== task.assigneeId) {
      if (!canAssignTaskTo(actor, dto.assigneeId)) {
        throw new ForbiddenException('You cannot reassign this task');
      }
      const assignee = await this.staffUsersService.findById(dto.assigneeId);
      if (!assignee) throw new NotFoundException('Assignee not found');
      task.assigneeId = dto.assigneeId;
    }

    if (dto.title !== undefined) task.title = dto.title.trim();
    if (dto.description !== undefined) task.description = dto.description;
    if (dto.dueDate !== undefined) task.dueDate = dto.dueDate;
    if (dto.status !== undefined) task.status = dto.status;
    if (dto.position !== undefined) task.position = dto.position;

    if (dto.status !== undefined && dto.position === undefined) {
      task.position = await this.nextPosition(task.assigneeId, task.status);
    }

    await this.taskRepo.save(task);
    return this.toView(await this.requireTask(task.id));
  }

  async remove(actor: StaffUser, id: string): Promise<void> {
    const task = await this.requireTask(id);
    if (!canDeleteTask(actor, task)) {
      throw new ForbiddenException('You cannot delete this task');
    }
    await this.taskRepo.delete({ id });
  }

  private async nextPosition(
    assigneeId: string,
    status: StaffTaskStatus,
  ): Promise<number> {
    const last = await this.taskRepo.findOne({
      where: { assigneeId, status },
      order: { position: 'DESC' },
    });
    return (last?.position ?? 0) + 1024;
  }

  private async requireTask(id: string): Promise<StaffTask> {
    const task = await this.taskRepo.findOne({
      where: { id },
      relations: { assignee: true },
    });
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  private toView(task: StaffTask): StaffTaskView {
    return {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      position: task.position,
      assigneeId: task.assigneeId,
      assigneeUsername: task.assignee?.username ?? '',
      createdById: task.createdById,
      dueDate: task.dueDate,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    };
  }
}
