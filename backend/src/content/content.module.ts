import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';
import { SiteContent } from './site-content.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SiteContent])],
  controllers: [ContentController],
  providers: [ContentService],
  // Returns and checkout read their windows and thresholds from the registry.
  exports: [ContentService],
})
export class ContentModule {}
