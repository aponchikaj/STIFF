import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';
import { User } from '../users/user.entity';
import { Reaction } from './reaction.entity';
import { ReactionsService } from './reactions.service';

/**
 * Toggling is a three-state move, not a boolean: pressing like when nothing is
 * set adds it, pressing it again takes it away, and pressing dislike while a
 * like is set *replaces* it rather than leaving both. The unique index on
 * (user, target) means the third case has to be an update — inserting a second
 * row would fail the constraint.
 */

const USER = { id: 'u1' } as User;
const TARGET = { targetType: 'product' as const, targetId: 'p1' };

describe('ReactionsService.toggle', () => {
  let service: ReactionsService;
  let reactionRepo: {
    findOne: jest.Mock;
    save: jest.Mock;
    create: jest.Mock;
    delete: jest.Mock;
    count: jest.Mock;
  };
  let productRepo: { exists: jest.Mock; update: jest.Mock };
  let galleryRepo: { exists: jest.Mock; update: jest.Mock };

  beforeEach(async () => {
    reactionRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockResolvedValue(undefined),
      create: jest.fn((v: unknown) => v),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      count: jest.fn().mockResolvedValue(0),
    };
    productRepo = {
      exists: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
    };
    galleryRepo = {
      exists: jest.fn().mockResolvedValue(true),
      update: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReactionsService,
        { provide: getRepositoryToken(Reaction), useValue: reactionRepo },
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(GalleryItem), useValue: galleryRepo },
      ],
    }).compile();

    service = module.get(ReactionsService);
  });

  it('refuses a target that does not exist', async () => {
    productRepo.exists.mockResolvedValue(false);
    await expect(
      service.toggle(USER, { ...TARGET, type: 'like' }),
    ).rejects.toThrow(NotFoundException);
    expect(reactionRepo.save).not.toHaveBeenCalled();
  });

  it('adds a reaction when the user had none', async () => {
    const result = await service.toggle(USER, { ...TARGET, type: 'like' });

    expect(reactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', targetId: 'p1', type: 'like' }),
    );
    expect(result.myReaction).toBe('like');
  });

  it('takes the reaction away when the same one is pressed again', async () => {
    reactionRepo.findOne.mockResolvedValue({ id: 'r1', type: 'like' });

    const result = await service.toggle(USER, { ...TARGET, type: 'like' });

    expect(reactionRepo.delete).toHaveBeenCalledWith({ id: 'r1' });
    expect(reactionRepo.save).not.toHaveBeenCalled();
    expect(result.myReaction).toBeNull();
  });

  /**
   * The case the unique index makes load-bearing: this has to update the row
   * that is already there, never insert a second one.
   */
  it('replaces the reaction when the other one is pressed', async () => {
    const existing = { id: 'r1', type: 'like' };
    reactionRepo.findOne.mockResolvedValue(existing);

    const result = await service.toggle(USER, { ...TARGET, type: 'dislike' });

    expect(reactionRepo.delete).not.toHaveBeenCalled();
    expect(reactionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'r1', type: 'dislike' }),
    );
    expect(result.myReaction).toBe('dislike');
  });

  /**
   * The denormalised counters are recounted from the reactions table rather
   * than incremented, so a lost race self-heals on the next press instead of
   * leaving the product with a number nothing backs up.
   */
  it('recounts both denormalised counters from the source of truth', async () => {
    reactionRepo.count.mockResolvedValueOnce(7).mockResolvedValueOnce(2);

    const result = await service.toggle(USER, { ...TARGET, type: 'like' });

    expect(productRepo.update).toHaveBeenCalledWith(
      { id: 'p1' },
      { likeCount: 7, dislikeCount: 2 },
    );
    expect(result).toMatchObject({ likeCount: 7, dislikeCount: 2 });
  });

  it('writes the counters onto the gallery item for a gallery target', async () => {
    reactionRepo.count.mockResolvedValueOnce(1).mockResolvedValueOnce(0);

    await service.toggle(USER, {
      targetType: 'gallery',
      targetId: 'g1',
      type: 'like',
    });

    expect(galleryRepo.update).toHaveBeenCalledWith(
      { id: 'g1' },
      { likeCount: 1, dislikeCount: 0 },
    );
    expect(productRepo.update).not.toHaveBeenCalled();
  });
});
