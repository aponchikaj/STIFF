import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GalleryItem } from '../gallery/gallery-item.entity';
import { Product } from '../products/product.entity';
import { Reaction } from './reaction.entity';
import { ReactionsController } from './reactions.controller';
import { ReactionsService } from './reactions.service';

@Module({
  imports: [TypeOrmModule.forFeature([Reaction, Product, GalleryItem])],
  controllers: [ReactionsController],
  providers: [ReactionsService],
})
export class ReactionsModule {}
