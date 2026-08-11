import { Controller, Get, Query } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Public } from '../common/decorators/public.decorator';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';

@Controller('search')
export class SearchController {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(GalleryItem)
    private readonly galleryRepo: Repository<GalleryItem>,
  ) {}

  @Public()
  @Get()
  async search(@Query('q') q?: string) {
    const query = (q ?? '').trim();
    if (query.length < 2) {
      return { query, products: [], gallery: [] };
    }
    const like = `%${query}%`;

    const [products, gallery] = await Promise.all([
      this.productRepo
        .createQueryBuilder('product')
        .where('product.isActive = true')
        .andWhere(
          '(product.name ILIKE :like OR product.description ILIKE :like OR product.category ILIKE :like)',
          { like },
        )
        .orderBy('product.likeCount', 'DESC')
        .take(12)
        .getMany(),
      this.galleryRepo
        .createQueryBuilder('item')
        // Archived shots are pulled from the public archive, so they must not
        // come back through search either.
        .where('item.isArchived = false')
        .andWhere(
          '(item.title ILIKE :like OR item.description ILIKE :like OR item.altText ILIKE :like)',
          { like },
        )
        .orderBy('item.createdAt', 'DESC')
        .take(12)
        .getMany(),
    ]);

    return { query, products, gallery };
  }
}
