import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { Subscriber } from './subscriber.entity';
import { SubscribersController } from './subscribers.controller';
import { SubscribersService } from './subscribers.service';

@Module({
  imports: [TypeOrmModule.forFeature([Subscriber]), MailModule],
  controllers: [SubscribersController],
  providers: [SubscribersService],
  exports: [SubscribersService],
})
export class SubscribersModule {}
