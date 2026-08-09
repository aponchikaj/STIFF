import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';
import { SearchController } from './search.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Product, GalleryItem])],
  controllers: [SearchController],
})
export class SearchModule {}
