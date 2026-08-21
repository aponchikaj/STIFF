import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  CONTENT_BLOCKS,
  CONTENT_KEYS,
  ContentBlock,
  ContentField,
  ContentListItem,
  defaultsFor,
  findBlock,
} from './content.registry';
import {
  DropConfig,
  DropState,
  nextTransitionAt,
  resolveDropState,
} from './drop';
import { SiteContent } from './site-content.entity';

const MAX_LIST_ITEMS = 24;
const MAX_LIST_TITLE = 120;
const MAX_LIST_BODY = 1000;

/** The drop block, plus the two things only the server can answer about it. */
export interface ResolvedDrop extends Record<string, unknown> {
  state: DropState;
  /** When the page should ask again, or null when nothing is scheduled. */
  nextTransitionAt: string | null;
  /**
   * The server's clock at the moment this was resolved.
   *
   * The browser seeds its countdown from this rather than from its own
   * `Date.now()`, so the first client render is byte-identical to the markup
   * the server sent. Without it, the two disagree by however long the request
   * took and React reports a hydration mismatch on the seconds digit of every
   * page load.
   */
  now: string;
}

export interface ResolvedContent {
  key: string;
  value: Record<string, unknown>;
  updatedAt: Date | null;
}

@Injectable()
export class ContentService {
  constructor(
    @InjectRepository(SiteContent)
    private readonly contentRepo: Repository<SiteContent>,
  ) {}

  private blockOrThrow(key: string): ContentBlock {
    const block = findBlock(key);
    if (!block) {
      throw new BadRequestException(
        `Unknown content key — valid keys: ${CONTENT_KEYS.join(', ')}`,
      );
    }
    return block;
  }

  /**
   * Never 404s. A block that has never been saved resolves to the copy shipped
   * in the registry, so a fresh database renders a complete site rather than
   * blank sections.
   */
  async get(key: string): Promise<ResolvedContent> {
    const block = this.blockOrThrow(key);
    const row = await this.contentRepo.findOne({ where: { key } });
    return {
      key,
      value: { ...defaultsFor(block), ...(row?.value ?? {}) },
      updatedAt: row?.updatedAt ?? null,
    };
  }

  /** Every block at once — one request for the admin form and the site shell. */
  async getAll(): Promise<ResolvedContent[]> {
    const rows = await this.contentRepo.find({
      where: { key: In(CONTENT_KEYS) },
    });
    const byKey = new Map(rows.map((row) => [row.key, row]));
    return CONTENT_BLOCKS.map((block) => {
      const row = byKey.get(block.key);
      return {
        key: block.key,
        value: { ...defaultsFor(block), ...(row?.value ?? {}) },
        updatedAt: row?.updatedAt ?? null,
      };
    });
  }

  /**
   * The drop block with its state resolved against the server's clock.
   *
   * The copy comes back whole so the hero can render any state without a
   * second request, and the state is the server's word on which one to show.
   */
  async drop(): Promise<ResolvedDrop> {
    const { value } = await this.get('home-drop');
    const config: DropConfig = {
      enabled: value.enabled === true,
      soldOut: value.soldOut === true,
      dropAt: typeof value.dropAt === 'string' ? value.dropAt : '',
      endsAt: typeof value.endsAt === 'string' ? value.endsAt : '',
    };
    const now = new Date();
    return {
      ...value,
      state: resolveDropState(config, now),
      nextTransitionAt: nextTransitionAt(config, now),
      now: now.toISOString(),
    };
  }

  async upsert(
    key: string,
    value: Record<string, unknown>,
  ): Promise<ResolvedContent> {
    const block = this.blockOrThrow(key);
    const clean = this.validate(block, value);

    const existing = await this.contentRepo.findOne({ where: { key } });
    if (existing) {
      // Merge so a partial save (one field from one form) cannot blank the rest.
      existing.value = { ...existing.value, ...clean };
      await this.contentRepo.save(existing);
    } else {
      await this.contentRepo.save(
        this.contentRepo.create({
          key,
          value: { ...defaultsFor(block), ...clean },
        }),
      );
    }
    return this.get(key);
  }

  /**
   * Accepts only the fields the block declares, and coerces each to its declared
   * type. Anything unknown is dropped rather than rejected so an older admin
   * build cannot fail a save against a newer registry.
   */
  private validate(
    block: ContentBlock,
    value: Record<string, unknown>,
  ): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const field of block.fields) {
      if (!(field.key in value)) continue;
      out[field.key] = this.coerce(block, field, value[field.key]);
    }
    if (Object.keys(out).length === 0) {
      throw new BadRequestException(
        `No known fields for "${block.key}" — expected ${block.fields
          .map((f) => f.key)
          .join(', ')}`,
      );
    }
    return out;
  }

  private coerce(
    block: ContentBlock,
    field: ContentField,
    raw: unknown,
  ): unknown {
    const where = `${block.key}.${field.key}`;

    if (field.type === 'boolean') {
      if (typeof raw !== 'boolean') {
        throw new BadRequestException(`${where} must be true or false`);
      }
      return raw;
    }

    if (field.type === 'list') {
      if (!Array.isArray(raw)) {
        throw new BadRequestException(`${where} must be a list`);
      }
      if (raw.length > MAX_LIST_ITEMS) {
        throw new BadRequestException(
          `${where} takes at most ${MAX_LIST_ITEMS} items`,
        );
      }
      return raw.map((item, i) => this.coerceListItem(where, item, i));
    }

    // text | textarea | image | datetime
    if (typeof raw !== 'string') {
      throw new BadRequestException(`${where} must be text`);
    }
    const trimmed = raw.trim();
    const max = field.maxLength ?? 5000;
    if (trimmed.length > max) {
      throw new BadRequestException(
        `${where} is longer than ${max} characters`,
      );
    }

    if (field.type === 'image' && trimmed) {
      // This value is rendered straight into a `src`. A relative path or an
      // https URL are the only two things that can be, and the check is here
      // rather than in the form because the form is not the only caller.
      const ok =
        trimmed.startsWith('/') && !trimmed.startsWith('//')
          ? true
          : /^https:\/\/[^\s]+$/i.test(trimmed);
      if (!ok) {
        throw new BadRequestException(
          `${where} must be an uploaded image path or an https:// URL`,
        );
      }
    }

    if (field.type === 'datetime' && trimmed) {
      const when = new Date(trimmed);
      if (Number.isNaN(when.getTime())) {
        throw new BadRequestException(`${where} is not a valid date and time`);
      }
      // Stored normalised, so everything downstream compares like with like
      // regardless of which timezone the admin's browser submitted.
      return when.toISOString();
    }

    return trimmed;
  }

  private coerceListItem(
    where: string,
    item: unknown,
    index: number,
  ): ContentListItem {
    if (!item || typeof item !== 'object' || Array.isArray(item)) {
      throw new BadRequestException(`${where}[${index}] must be an object`);
    }
    const { title, body } = item as Record<string, unknown>;
    if (typeof title !== 'string' || typeof body !== 'string') {
      throw new BadRequestException(
        `${where}[${index}] needs a title and a body`,
      );
    }
    const cleanTitle = title.trim();
    const cleanBody = body.trim();
    if (!cleanTitle) {
      throw new BadRequestException(`${where}[${index}] needs a title`);
    }
    if (cleanTitle.length > MAX_LIST_TITLE) {
      throw new BadRequestException(
        `${where}[${index}] title is longer than ${MAX_LIST_TITLE} characters`,
      );
    }
    if (cleanBody.length > MAX_LIST_BODY) {
      throw new BadRequestException(
        `${where}[${index}] body is longer than ${MAX_LIST_BODY} characters`,
      );
    }
    return { title: cleanTitle, body: cleanBody };
  }
}
