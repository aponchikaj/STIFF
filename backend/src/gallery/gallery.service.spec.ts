import { ConflictException, NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { Comment } from '../comments/comment.entity';
import { Reaction } from '../reactions/reaction.entity';
import { User } from '../users/user.entity';
import { GalleryItem } from './gallery-item.entity';
import { GalleryService } from './gallery.service';

/**
 * A shot with sensible defaults — tests override only the field under test.
 */
function shot(overrides: Partial<GalleryItem> = {}): GalleryItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: '0001',
    title: '0001',
    description: null,
    altText: null,
    imageUrl: 'https://example.com/a.jpg',
    width: 100,
    height: 100,
    sortOrder: 0,
    isArchived: false,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    createdAt: new Date(),
    ...overrides,
  };
}

/** Chainable query-builder stub; terminal methods are set per test. */
function queryBuilder() {
  const qb: Record<string, jest.Mock> = {};
  const chain = [
    'select',
    'addSelect',
    'where',
    'andWhere',
    'orderBy',
    'addOrderBy',
    'skip',
    'take',
    'limit',
  ];
  for (const method of chain) qb[method] = jest.fn(() => qb);
  qb.getRawOne = jest.fn().mockResolvedValue({ max: null });
  qb.getCount = jest.fn().mockResolvedValue(0);
  qb.getOne = jest.fn().mockResolvedValue(null);
  qb.getManyAndCount = jest.fn().mockResolvedValue([[], 0]);
  return qb;
}

describe('GalleryService', () => {
  let service: GalleryService;
  let repo: {
    findOne: jest.Mock;
    create: jest.Mock;
    save: jest.Mock;
    count: jest.Mock;
    delete: jest.Mock;
    createQueryBuilder: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let qb: ReturnType<typeof queryBuilder>;
  let update: jest.Mock;

  beforeEach(async () => {
    qb = queryBuilder();
    update = jest.fn();
    repo = {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn((row: Partial<GalleryItem>) => row as GalleryItem),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
      count: jest.fn().mockResolvedValue(0),
      delete: jest.fn().mockResolvedValue(undefined),
      createQueryBuilder: jest.fn(() => qb),
      manager: {
        transaction: jest.fn((cb: (m: unknown) => Promise<void>) =>
          cb({ update }),
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GalleryService,
        { provide: getRepositoryToken(GalleryItem), useValue: repo },
        {
          provide: getRepositoryToken(Comment),
          useValue: { delete: jest.fn() },
        },
        {
          provide: getRepositoryToken(Reaction),
          useValue: { delete: jest.fn(), findOne: jest.fn() },
        },
      ],
    }).compile();

    service = module.get(GalleryService);
  });

  describe('getBySlug', () => {
    it('resolves a shot by its slug', async () => {
      const item = shot({ slug: '0057', title: '0057' });
      repo.findOne.mockResolvedValueOnce(item);

      const result = await service.getBySlug('0057');

      expect(result.slug).toBe('0057');
      expect(repo.findOne).toHaveBeenCalledWith({ where: { slug: '0057' } });
    });

    it('falls back to the title so links shared before slugs existed still open', async () => {
      const item = shot({ slug: 'renamed', title: 'Old Title' });
      // First lookup (by slug) misses, second (by title) hits.
      repo.findOne.mockResolvedValueOnce(null).mockResolvedValueOnce(item);

      const result = await service.getBySlug('Old Title');

      expect(result.id).toBe(item.id);
      expect(repo.findOne).toHaveBeenNthCalledWith(2, {
        where: { title: 'Old Title' },
      });
    });

    it('resolves a raw UUID', async () => {
      const id = '22222222-2222-4222-8222-222222222222';
      repo.findOne.mockResolvedValueOnce(shot({ id }));

      await service.getBySlug(id);

      expect(repo.findOne).toHaveBeenCalledWith({ where: { id } });
    });

    it('hides an archived shot from the public', async () => {
      repo.findOne.mockResolvedValueOnce(shot({ isArchived: true }));

      await expect(service.getBySlug('0001')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('still shows an archived shot to an admin', async () => {
      repo.findOne.mockResolvedValueOnce(shot({ isArchived: true }));

      const result = await service.getBySlug('0001', {
        role: 'admin',
      } as User);

      expect(result.isArchived).toBe(true);
    });

    it('404s when nothing matches', async () => {
      await expect(service.getBySlug('nope')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('turns a written title into a URL-safe slug', async () => {
      const created = await service.create({
        title: 'Summer Shoot 01',
        imageUrl: 'https://example.com/a.jpg',
      });

      expect(created.slug).toBe('summer-shoot-01');
      expect(created.title).toBe('Summer Shoot 01');
    });

    it('leaves an archive number untouched', async () => {
      const created = await service.create({
        title: '0058',
        imageUrl: 'https://example.com/a.jpg',
      });

      expect(created.slug).toBe('0058');
    });

    it('rejects a slug already in use', async () => {
      repo.findOne.mockResolvedValueOnce(shot({ id: 'other', slug: '0001' }));

      await expect(
        service.create({ title: '0001', imageUrl: 'x' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('createMany', () => {
    it('numbers untitled shots from the end of the archive', async () => {
      qb.getRawOne
        .mockResolvedValueOnce({ max: '57' }) // highest existing number
        .mockResolvedValueOnce({ max: 12 }); // highest sortOrder

      const created = await service.createMany([
        { imageUrl: 'https://example.com/a.jpg' },
        { imageUrl: 'https://example.com/b.jpg' },
      ]);

      expect(created.map((c) => c.title)).toEqual(['0058', '0059']);
      expect(created.map((c) => c.slug)).toEqual(['0058', '0059']);
    });

    it('keeps the order files were added in', async () => {
      qb.getRawOne
        .mockResolvedValueOnce({ max: '57' })
        .mockResolvedValueOnce({ max: 12 });

      const created = await service.createMany([
        { imageUrl: 'a' },
        { imageUrl: 'b' },
      ]);

      expect(created.map((c) => c.sortOrder)).toEqual([13, 14]);
    });

    it('starts at 0001 on an empty archive', async () => {
      qb.getRawOne
        .mockResolvedValueOnce({ max: null })
        .mockResolvedValueOnce({ max: null });

      const created = await service.createMany([{ imageUrl: 'a' }]);

      expect(created[0].title).toBe('0001');
    });

    it('catches two files in the same batch claiming one slug', async () => {
      qb.getRawOne
        .mockResolvedValueOnce({ max: '1' })
        .mockResolvedValueOnce({ max: 0 });

      await expect(
        service.createMany([
          { title: 'Same Name', imageUrl: 'a' },
          { title: 'same name', imageUrl: 'b' },
        ]),
      ).rejects.toBeInstanceOf(ConflictException);
    });
  });

  describe('reorder', () => {
    it('writes every position in one transaction', async () => {
      await service.reorder([
        { id: 'a', sortOrder: 0 },
        { id: 'b', sortOrder: 1 },
      ]);

      expect(repo.manager.transaction).toHaveBeenCalledTimes(1);
      expect(update).toHaveBeenCalledTimes(2);
      expect(update).toHaveBeenCalledWith(
        GalleryItem,
        { id: 'b' },
        { sortOrder: 1 },
      );
    });
  });
});
