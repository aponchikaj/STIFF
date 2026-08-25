import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Product } from '../products/product.entity';
import { ProductsModule } from '../products/products.module';
import { Comment } from './comment.entity';
import { CommentsController } from './comments.controller';
import { CommentsService } from './comments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Comment, Product, GalleryItem]),
    NotificationsModule,
    // For ProductLinksService.buyersAmong — the verified-buyer badge.
    ProductsModule,
  ],
  controllers: [CommentsController],
  providers: [CommentsService],
})
export class CommentsModule {}
