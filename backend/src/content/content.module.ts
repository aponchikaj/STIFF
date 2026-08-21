import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { InstagramService } from './instagram.service';
import { SiteContent } from './site-content.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SiteContent])],
  controllers: [ContentController],
  providers: [ContentService, InstagramService],
  // Returns and checkout read their windows and thresholds from the registry.
  exports: [ContentService, InstagramService],
})
export class ContentModule {}
