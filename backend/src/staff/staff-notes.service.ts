import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreateStaffNoteDto, UpdateStaffNoteDto } from './dto/staff-notes.dto';
import { StaffNote } from './entities/staff-note.entity';
import { StaffUser } from './entities/staff-user.entity';

export interface StaffNoteView {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class StaffNotesService {
  constructor(
    @InjectRepository(StaffNote)
    private readonly noteRepo: Repository<StaffNote>,
  ) {}

  async list(user: StaffUser): Promise<StaffNoteView[]> {
    const rows = await this.noteRepo.find({
      where: { userId: user.id },
      order: { pinned: 'DESC', updatedAt: 'DESC' },
    });
    return rows.map((row) => this.toView(row));
  }

  async create(
    user: StaffUser,
    dto: CreateStaffNoteDto,
  ): Promise<StaffNoteView> {
    const note = await this.noteRepo.save(
      this.noteRepo.create({
        userId: user.id,
        title: dto.title.trim(),
        body: dto.body ?? '',
        pinned: false,
      }),
    );
    return this.toView(note);
  }

  async update(
    user: StaffUser,
    id: string,
    dto: UpdateStaffNoteDto,
  ): Promise<StaffNoteView> {
    const note = await this.requireOwn(user.id, id);
    if (dto.title !== undefined) note.title = dto.title.trim();
    if (dto.body !== undefined) note.body = dto.body;
    if (dto.pinned !== undefined) note.pinned = dto.pinned;
    await this.noteRepo.save(note);
    return this.toView(note);
  }

  async remove(user: StaffUser, id: string): Promise<void> {
    await this.requireOwn(user.id, id);
    await this.noteRepo.delete({ id, userId: user.id });
  }

  private async requireOwn(userId: string, id: string): Promise<StaffNote> {
    const note = await this.noteRepo.findOne({ where: { id, userId } });
    if (!note) throw new NotFoundException('Note not found');
    return note;
  }

  private toView(note: StaffNote): StaffNoteView {
    return {
      id: note.id,
      title: note.title,
      body: note.body,
      pinned: note.pinned,
      createdAt: note.createdAt,
      updatedAt: note.updatedAt,
    };
  }
}
