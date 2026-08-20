import { ForbiddenException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { OrderItem } from '../orders/order-item.entity';
import { FitService } from './fit.service';
import { ProductFitRating } from './product-fit-rating.entity';
import { Product } from './product.entity';

/**
 * The gate is the whole value of this rating: a fit report from someone who
 * never wore the garment says nothing about how it fits, and would be trivial
 * to spam.
 */
describe('FitService', () => {
  let service: FitService;
  let fitRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let purchasedSizes: jest.Mock;

  beforeEach(async () => {
    fitRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      save: jest.fn((row: unknown) => Promise.resolve(row)),
      create: jest.fn((row: unknown) => row),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FitService,
        { provide: getRepositoryToken(ProductFitRating), useValue: fitRepo },
        {
          provide: getRepositoryToken(OrderItem),
          useValue: { createQueryBuilder: jest.fn() },
        },
        {
          provide: DataSource,
          useValue: {
            transaction: jest.fn((cb: (m: unknown) => Promise<unknown>) =>
              cb({
                getRepository: () => ({
                  ...fitRepo,
                  find: jest.fn().mockResolvedValue([{ value: 0 }]),
                  update: jest.fn(),
                  findOneOrFail: jest.fn().mockResolvedValue({
                    id: 'product-1',
                    fitSmallCount: 0,
                    fitTrueCount: 1,
                    fitLargeCount: 0,
                  }),
                }),
              }),
            ),
          },
        },
      ],
    }).compile();

    service = module.get(FitService);
    // The purchase lookup is a raw query builder against two tables; stubbing
    // the method keeps this about the rule rather than about SQL.
    purchasedSizes = jest.fn().mockResolvedValue([]);
    service.purchasedSizes = purchasedSizes;
  });

  it('refuses a rating from someone who never bought the piece', async () => {
    await expect(service.rate('product-1', 'user-1', 0)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(fitRepo.save).not.toHaveBeenCalled();
  });

  it('accepts one from a buyer, and snapshots the size they wore', async () => {
    purchasedSizes.mockResolvedValue(['M']);
    await service.rate('product-1', 'user-1', 0);
    expect(fitRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ productId: 'product-1', value: 0, size: 'M' }),
    );
  });

  it('lets an existing rater change their mind after the size is retired', async () => {
    // They bought it, rated it, and the size has since been withdrawn — the
    // purchase lookup can come back empty. Refusing the edit here would strand
    // a rating they can no longer correct.
    purchasedSizes.mockResolvedValue([]);
    fitRepo.findOne.mockResolvedValue({
      id: 'rating-1',
      productId: 'product-1',
      userId: 'user-1',
      value: 0,
      size: 'M',
    });
    await service.rate('product-1', 'user-1', -1);
    expect(fitRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ value: -1, size: 'M' }),
    );
  });

  it('reports nothing rateable to a signed-out reader', async () => {
    const report = await service.reportFor({
      id: 'product-1',
      fitSmallCount: 4,
      fitTrueCount: 1,
      fitLargeCount: 0,
    } as Product);
    expect(report.canRate).toBe(false);
    expect(report.mine).toBeNull();
    expect(report.verdict).toBe('runs_small');
  });

  it('offers the control to someone who already rated, so they can undo', async () => {
    purchasedSizes.mockResolvedValue([]);
    fitRepo.findOne.mockResolvedValue({ value: 1 });
    const report = await service.reportFor(
      {
        id: 'product-1',
        fitSmallCount: 0,
        fitTrueCount: 0,
        fitLargeCount: 1,
      } as Product,
      'user-1',
    );
    expect(report.canRate).toBe(true);
    expect(report.mine).toBe(1);
  });
});
