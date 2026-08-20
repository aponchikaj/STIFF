import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';
import {
  GALLERY_TSV,
  PRODUCT_TSV,
  TRIGRAM_THRESHOLD,
  prefixTerm,
  tsQuery,
} from './search.sql';

export const MIN_QUERY_LENGTH = 2;
const LIMIT = 12;

export interface SearchResults {
  query: string;
  products: Product[];
  gallery: GalleryItem[];
}

@Injectable()
export class SearchService {
  constructor(
    @InjectRepository(Product)
    private readonly productRepo: Repository<Product>,
    @InjectRepository(GalleryItem)
    private readonly galleryRepo: Repository<GalleryItem>,
  ) {}

  async search(rawQuery: string): Promise<SearchResults> {
    const query = rawQuery.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      return { query, products: [], gallery: [] };
    }

    const [products, gallery] = await Promise.all([
      this.searchProducts(query),
      this.searchGallery(query),
    ]);
    return { query, products, gallery };
  }

  private async searchProducts(query: string): Promise<Product[]> {
    const qb = this.productRepo
      .createQueryBuilder('product')
      .where('product.isActive = true');

    this.applyMatch(qb, query, {
      tsv: PRODUCT_TSV,
      trigramColumn: 'product."name"',
      // Popularity is the tie-breaker, not the ranking — a weak text match
      // should never outrank a strong one just because it has more likes.
      tieBreaker: { column: 'product."likeCount"', direction: 'DESC' },
    });

    return qb.take(LIMIT).getMany();
  }

  private async searchGallery(query: string): Promise<GalleryItem[]> {
    const qb = this.galleryRepo
      .createQueryBuilder('item')
      // Archived shots are pulled from the public archive, so they must not
      // come back through search either.
      .where('item.isArchived = false');

    this.applyMatch(qb, query, {
      tsv: GALLERY_TSV,
      trigramColumn: 'item."title"',
      tieBreaker: { column: 'item."createdAt"', direction: 'DESC' },
    });

    return qb.take(LIMIT).getMany();
  }

  /**
   * Three ways to match, in descending confidence:
   *   1. full-text on the weighted vector — handles stemming ("hoodies" finds
   *      "hoodie") and multi-word queries;
   *   2. a prefix query on the last token, so results appear mid-word;
   *   3. trigram similarity, which survives a typo ("hoodei").
   *
   * Ranking puts real text matches first and uses similarity only to order the
   * fuzzy tail, so a typo'd query degrades gracefully instead of returning junk.
   */
  private applyMatch<T extends Product | GalleryItem>(
    qb: SelectQueryBuilder<T>,
    query: string,
    opts: {
      tsv: string;
      trigramColumn: string;
      tieBreaker: { column: string; direction: 'ASC' | 'DESC' };
    },
  ): void {
    const { tsv, trigramColumn, tieBreaker } = opts;
    const prefix = prefixTerm(query);

    const clauses = [`${tsv} @@ ${tsQuery('q')}`];
    if (prefix) clauses.push(`${tsv} @@ to_tsquery('english', :prefix)`);
    clauses.push(`similarity(${trigramColumn}, :raw) > :threshold`);

    qb.andWhere(`(${clauses.join(' OR ')})`, {
      q: query,
      ...(prefix ? { prefix } : {}),
      raw: query,
      threshold: TRIGRAM_THRESHOLD,
    });

    qb.addSelect(`ts_rank(${tsv}, ${tsQuery('q')})`, 'rank')
      .addSelect(`similarity(${trigramColumn}, :raw)`, 'sim')
      .orderBy('rank', 'DESC')
      .addOrderBy('sim', 'DESC')
      .addOrderBy(tieBreaker.column, tieBreaker.direction);
  }
}
