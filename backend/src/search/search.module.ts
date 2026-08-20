import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';

@Module({
  imports: [TypeOrmModule.forFeature([Product, GalleryItem])],
  controllers: [SearchController],
  providers: [SearchService],
})
export class SearchModule {}
