import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { ProductLinksService } from '../products/product-links.service';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { Comment } from './comment.entity';
import { CommentsService } from './comments.service';

/**
 * Who may edit and delete a comment, and what a reply is allowed to attach to.
 *
 * Editing and deleting deliberately differ: an admin may take a comment down
 * but may not rewrite one, because a comment edited by someone other than its
 * author still carries that author's name.
 */

const AUTHOR = { id: 'u1', username: 'author', role: 'user' } as User;
const OTHER = { id: 'u2', username: 'other', role: 'user' } as User;
const ADMIN = { id: 'u3', username: 'boss', role: 'admin' } as User;

function comment(overrides: Partial<Comment> = {}): Comment {
  return {
    id: 'c1',
    userId: AUTHOR.id,
    user: AUTHOR,
    targetType: 'product',
    targetId: 'p1',
    parentId: null,
    body: 'original',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Comment;
}

describe('CommentsService', () => {
  let service: CommentsService;
  let commentRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  let productRepo: { exists: jest.Mock; update: jest.Mock };
  let galleryRepo: { exists: jest.Mock; update: jest.Mock };
  let notifications: { notify: jest.Mock };

  beforeEach(async () => {
    commentRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((c: unknown) => Promise.resolve(c)),
      create: jest.fn((c: unknown) => c),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(3),
    };
    productRepo = {
      exists: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
    };
    galleryRepo = {
      exists: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
    };
    notifications = { notify: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CommentsService,
        { provide: getRepositoryToken(Comment), useValue: commentRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(GalleryItem), useValue: galleryRepo },
        { provide: NotificationsService, useValue: notifications },
        { provide: ProductLinksService, useValue: { buyersAmong: jest.fn() } },
      ],
    }).compile();

    service = module.get(CommentsService);
  });

  describe('create', () => {
    it('refuses to comment on something that does not exist', async () => {
      productRepo.exists.mockResolvedValue(false);
      await expect(
        service.create(AUTHOR, {
          targetType: 'product',
          targetId: 'gone',
          body: 'hi',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    /**
     * A reply carries its own target, so nothing stops a client sending a
     * parent from a different product. Left unchecked, a thread on one product
     * would surface under another.
     */
    it('refuses a parent that belongs to a different target', async () => {
      commentRepo.findOne.mockResolvedValue(comment({ targetId: 'p2' }));
      await expect(
        service.create(AUTHOR, {
          targetType: 'product',
          targetId: 'p1',
          body: 'reply',
          parentId: 'c1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a parent that is not there', async () => {
      commentRepo.findOne.mockResolvedValue(null);
      await expect(
        service.create(AUTHOR, {
          targetType: 'product',
          targetId: 'p1',
          body: 'reply',
          parentId: 'missing',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('tells the parent author someone replied', async () => {
      commentRepo.findOne.mockResolvedValue(comment({ userId: OTHER.id }));

      await service.create(AUTHOR, {
        targetType: 'product',
        targetId: 'p1',
        body: 'replying to you',
        parentId: 'c1',
      });

      expect(notifications.notify).toHaveBeenCalledWith(
        OTHER.id,
        'comment_reply',
        expect.stringContaining('author'),
        'replying to you',
        expect.objectContaining({ targetId: 'p1' }),
      );
    });

    /** Nobody wants to be told they replied to themselves. */
    it('stays quiet when someone replies to their own comment', async () => {
      commentRepo.findOne.mockResolvedValue(comment({ userId: AUTHOR.id }));

      await service.create(AUTHOR, {
        targetType: 'product',
        targetId: 'p1',
        body: 'more from me',
        parentId: 'c1',
      });

      expect(notifications.notify).not.toHaveBeenCalled();
    });

    it('keeps the denormalised count on the product in step', async () => {
      commentRepo.count.mockResolvedValue(9);
      await service.create(AUTHOR, {
        targetType: 'product',
        targetId: 'p1',
        body: 'hi',
      });
      expect(productRepo.update).toHaveBeenCalledWith(
        { id: 'p1' },
        { commentCount: 9 },
      );
    });
  });

  describe('update', () => {
    it('lets an author rewrite their own comment', async () => {
      commentRepo.findOne.mockResolvedValue(comment());
      const result = await service.update(AUTHOR, 'c1', { body: 'edited' });
      expect(result.body).toBe('edited');
    });

    it("refuses to let anyone rewrite another person's comment", async () => {
      commentRepo.findOne.mockResolvedValue(comment());
      await expect(
        service.update(OTHER, 'c1', { body: 'not yours' }),
      ).rejects.toThrow(ForbiddenException);
    });

    /**
     * Deliberate asymmetry with `remove`. An admin can take a comment down but
     * not put words in its author's mouth — an edited comment still carries
     * the original name.
     */
    it('refuses an admin too, unlike deleting', async () => {
      commentRepo.findOne.mockResolvedValue(comment());
      await expect(
        service.update(ADMIN, 'c1', { body: 'moderated' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('is a 404 when the comment is gone', async () => {
      commentRepo.findOne.mockResolvedValue(null);
      await expect(service.update(AUTHOR, 'c1', { body: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('remove', () => {
    it('lets an author delete their own comment', async () => {
      commentRepo.findOne.mockResolvedValue(comment());
      await service.remove(AUTHOR, 'c1');
      expect(commentRepo.delete).toHaveBeenCalledWith({ id: 'c1' });
    });

    it('lets an admin moderate anyone', async () => {
      commentRepo.findOne.mockResolvedValue(comment());
      await service.remove(ADMIN, 'c1');
      expect(commentRepo.delete).toHaveBeenCalledWith({ id: 'c1' });
    });

    it("refuses to let a shopper delete someone else's", async () => {
      commentRepo.findOne.mockResolvedValue(comment());
      await expect(service.remove(OTHER, 'c1')).rejects.toThrow(
        ForbiddenException,
      );
      expect(commentRepo.delete).not.toHaveBeenCalled();
    });

    /** Replies cascade, so the count has to be re-read, not decremented. */
    it('recounts the target after a delete', async () => {
      commentRepo.findOne.mockResolvedValue(
        comment({ targetType: 'gallery', targetId: 'g1' }),
      );
      commentRepo.count.mockResolvedValue(0);

      await service.remove(AUTHOR, 'c1');

      expect(galleryRepo.update).toHaveBeenCalledWith(
        { id: 'g1' },
        { commentCount: 0 },
      );
    });
  });
});
