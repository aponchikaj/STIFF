import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../users/user.entity';
import {
  CreateGalleryItemDto,
  ListGalleryQueryDto,
  UpdateGalleryItemDto,
} from './dto/gallery.dto';
import { GalleryService } from './gallery.service';

@Controller('gallery')
export class GalleryController {
  constructor(private readonly galleryService: GalleryService) {}

  @Public()
  @Get()
  list(@Query() query: ListGalleryQueryDto, @CurrentUser() user?: User) {
    return this.galleryService.list(query, user);
  }

  /** `slug` is the stable URL slug (/gallery/{slug}); UUIDs still resolve. */
  @Public()
  @Get(':slug')
  getOne(@Param('slug') slug: string, @CurrentUser() user?: User) {
    return this.galleryService.getBySlug(slug, user);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateGalleryItemDto) {
    return this.galleryService.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateGalleryItemDto,
  ) {
    return this.galleryService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    await this.galleryService.remove(id);
    return { success: true };
  }
}
