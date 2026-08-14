import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CollabCampaign } from './collab-campaign.entity';
import { CollabCode } from './collab-code.entity';
import { CollabController } from './collab.controller';
import { CollabService } from './collab.service';
import { CollabSession } from './collab-session.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([CollabCampaign, CollabCode, CollabSession]),
  ],
  controllers: [CollabController],
  providers: [CollabService],
})
export class CollabModule {}
