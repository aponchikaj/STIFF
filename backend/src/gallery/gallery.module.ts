import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/comment.entity';
import { ProductsModule } from '../products/products.module';
import { Reaction } from '../reactions/reaction.entity';
import { GalleryItem } from './gallery-item.entity';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([GalleryItem, Comment, Reaction]),
    // For ProductLinksService's gallery <-> product links.
    ProductsModule,
  ],
  controllers: [GalleryController],
  providers: [GalleryService],
  exports: [GalleryService],
})
export class GalleryModule {}
