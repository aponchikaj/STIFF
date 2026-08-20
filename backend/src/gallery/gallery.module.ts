import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Comment } from '../comments/comment.entity';
import { ProductsModule } from '../products/products.module';
import { Reaction } from '../reactions/reaction.entity';
import { GalleryCredit } from './gallery-credit.entity';
import { GalleryItem } from './gallery-item.entity';
import { GalleryShoot } from './gallery-shoot.entity';
import { GalleryTag } from './gallery-tag.entity';
import { GalleryController } from './gallery.controller';
import { GalleryService } from './gallery.service';
import { PlaceholderService } from './placeholder.service';
import { ShootsService } from './shoots.service';
import { TagsService } from './tags.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      GalleryItem,
      Comment,
      Reaction,
      GalleryShoot,
      GalleryCredit,
      GalleryTag,
    ]),
    // For FitService's gallery <-> product links.
    ProductsModule,
  ],
  controllers: [GalleryController],
  providers: [GalleryService, ShootsService, TagsService, PlaceholderService],
  exports: [GalleryService, ShootsService, TagsService, PlaceholderService],
})
export class GalleryModule {}
