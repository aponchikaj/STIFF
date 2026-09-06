import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { Comment } from '../comments/comment.entity';
import { OrderItem } from '../orders/order-item.entity';
import { Reaction } from '../reactions/reaction.entity';
import { ProductLinksService } from './product-links.service';
import { Product } from './product.entity';
import { ProductsService } from './products.service';
import { VariantsService } from './variants.service';

/**
 * Deleting a product.
 *
 * Two paths, and the choice between them is not cosmetic: a product that was
 * ever ordered keeps its row, because deleting it would blank the name and size
 * on somebody's receipt.
 */
describe('ProductsService.remove', () => {
  let service: ProductsService;
  let productRepo: Record<string, jest.Mock>;
  let orderItemRepo: { exists: jest.Mock };
  let managerDelete: jest.Mock;
  let transaction: jest.Mock;

  beforeEach(async () => {
    productRepo = {
      findOne: jest.fn().mockResolvedValue({ id: 'p1', isActive: true }),
      save: jest.fn((p: unknown) => Promise.resolve(p)),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    orderItemRepo = { exists: jest.fn().mockResolvedValue(false) };
    managerDelete = jest.fn().mockResolvedValue({ affected: 1 });
    transaction = jest.fn(
      async (cb: (m: unknown) => Promise<unknown>) =>
        await cb({ delete: managerDelete }),
    );

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        { provide: getRepositoryToken(Product), useValue: productRepo },
        { provide: getRepositoryToken(Comment), useValue: {} },
        { provide: getRepositoryToken(Reaction), useValue: {} },
        { provide: getRepositoryToken(OrderItem), useValue: orderItemRepo },
        { provide: VariantsService, useValue: {} },
        { provide: ProductLinksService, useValue: {} },
        { provide: DataSource, useValue: { transaction } },
      ],
    }).compile();

    service = module.get(ProductsService);
  });

  it('is a 404 for a product that is not there', async () => {
    productRepo.findOne.mockResolvedValue(null);
    await expect(service.remove('p1')).rejects.toThrow(NotFoundException);
  });

  /**
   * A product on somebody's receipt keeps its row. Deleting it would blank the
   * name and size on a historical order line.
   */
  it('deactivates rather than deletes a product that was ordered', async () => {
    orderItemRepo.exists.mockResolvedValue(true);

    const result = await service.remove('p1');

    expect(result).toEqual({ success: true, soft: true });
    expect(productRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ isActive: false }),
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  /**
   * The regression this file exists for. The three deletes used to run
   * unwrapped: a failure on the product delete left the comments and reactions
   * already gone, so the product survived with its discussion silently erased —
   * worse than either outcome on its own.
   */
  it('deletes the product and its discussion in one transaction', async () => {
    const result = await service.remove('p1');

    expect(result).toEqual({ success: true, soft: false });
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(managerDelete).toHaveBeenCalledTimes(3);
    expect(managerDelete).toHaveBeenCalledWith(Comment, {
      targetType: 'product',
      targetId: 'p1',
    });
    expect(managerDelete).toHaveBeenCalledWith(Reaction, {
      targetType: 'product',
      targetId: 'p1',
    });
    expect(managerDelete).toHaveBeenCalledWith(Product, { id: 'p1' });
  });

  it('leaves nothing deleted outside the transaction', async () => {
    await service.remove('p1');
    expect(productRepo.delete).not.toHaveBeenCalled();
  });

  /** A failure rolls the whole thing back rather than half of it. */
  it('propagates a failure instead of reporting success', async () => {
    transaction.mockRejectedValue(new Error('deadlock'));
    await expect(service.remove('p1')).rejects.toThrow('deadlock');
  });
});
