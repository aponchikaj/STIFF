import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginate } from '../common/types/paginated';
import { ContactMessage } from './contact-message.entity';
import { ListContactQueryDto, SubmitContactDto } from './dto/contact.dto';

@Injectable()
export class ContactService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactRepo: Repository<ContactMessage>,
  ) {}

  async submit(dto: SubmitContactDto): Promise<ContactMessage> {
    return this.contactRepo.save(
      this.contactRepo.create({
        name: dto.name,
        email: dto.email.toLowerCase(),
        subject: dto.subject ?? null,
        message: dto.message,
      }),
    );
  }

  async list(query: ListContactQueryDto): Promise<Paginated<ContactMessage>> {
    const where =
      query.handled === undefined ? {} : { isHandled: query.handled };
    const [items, total] = await this.contactRepo.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: query.skip,
      take: query.pageSize,
    });
    return paginate(items, total, query.page, query.pageSize);
  }

  async setHandled(id: string, handled: boolean): Promise<ContactMessage> {
    const message = await this.contactRepo.findOne({ where: { id } });
    if (!message) throw new NotFoundException('Message not found');
    message.isHandled = handled;
    return this.contactRepo.save(message);
  }

  async remove(id: string): Promise<void> {
    const result = await this.contactRepo.delete({ id });
    if (!result.affected) throw new NotFoundException('Message not found');
  }

  countPending(): Promise<number> {
    return this.contactRepo.count({ where: { isHandled: false } });
  }
}
