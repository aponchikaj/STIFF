import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ContentService } from './content.service';
import { UpdateContentDto } from './dto/content.dto';

@Controller('content')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Public()
  @Get(':key')
  get(@Param('key') key: string) {
    return this.contentService.get(key);
  }

  @Put(':key')
  @Roles('admin')
  update(@Param('key') key: string, @Body() dto: UpdateContentDto) {
    return this.contentService.upsert(key, dto.value);
  }
}
