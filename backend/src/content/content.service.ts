import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CONTENT_KEYS, SiteContent } from './site-content.entity';

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(SiteContent)
    private readonly contentRepo: Repository<SiteContent>,
  ) {}

  private assertKey(key: string): void {
    if (!(CONTENT_KEYS as readonly string[]).includes(key)) {
      throw new BadRequestException(
        `Unknown content key — valid keys: ${CONTENT_KEYS.join(', ')}`,
      );
    }
  }

  async get(key: string): Promise<SiteContent> {
    this.assertKey(key);
    const content = await this.contentRepo.findOne({ where: { key } });
    if (!content) throw new NotFoundException('Content not set yet');
    return content;
  }

  async upsert(
    key: string,
    value: Record<string, unknown>,
  ): Promise<SiteContent> {
    this.assertKey(key);
    const existing = await this.contentRepo.findOne({ where: { key } });
    if (existing) {
      existing.value = value;
      return this.contentRepo.save(existing);
    }
    return this.contentRepo.save(this.contentRepo.create({ key, value }));
  }
}
