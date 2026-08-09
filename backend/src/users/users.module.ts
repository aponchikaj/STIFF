import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RefreshToken } from '../auth/refresh-token.entity';
import { Comment } from '../comments/comment.entity';
import { Order } from '../orders/order.entity';
import { Reaction } from '../reactions/reaction.entity';
import { SeedService } from './seed.service';
import { User } from './user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Order, Comment, Reaction, RefreshToken]),
  ],
  controllers: [UsersController],
  providers: [UsersService, SeedService],
  exports: [UsersService],
})
export class UsersModule {}
