import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { User } from '../users/user.entity';
import {
  BulkCreateGalleryItemsDto,
  CreateGalleryItemDto,
  ListGalleryQueryDto,
  ReorderGalleryDto,
  UpdateGalleryItemDto,
} from './dto/gallery.dto';
import {
  ListShootsQueryDto,
  ShootInputDto,
  TagInputDto,
} from './dto/shoot.dto';
import { GalleryService } from './gallery.service';
import { PlaceholderService } from './placeholder.service';
import { ShootsService } from './shoots.service';
import { TagsService } from './tags.service';

@Controller('gallery')
export class GalleryController {
  constructor(
    private readonly galleryService: GalleryService,
    private readonly shootsService: ShootsService,
    private readonly tagsService: TagsService,
    private readonly placeholders: PlaceholderService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListGalleryQueryDto, @CurrentUser() user?: User) {
    return this.galleryService.list(query, user);
  }

  // ---- shoots and tags -------------------------------------------------
  //
  // Every literal path here is declared before `@Get(':slug')`. That route
  // matches any single segment, so "shoots" would otherwise be read as the
  // slug of a photograph and 404 before it ever reached these.

  @Public()
  @Get('shoots')
  listShoots(@CurrentUser() user?: User) {
    return this.shootsService.list(user);
  }

  /** Shots not yet in any shoot, for the admin assigner. */
  @Get('shoots/ungrouped')
  @Roles('admin')
  ungroupedShots() {
    return this.shootsService.ungrouped();
  }

  @Public()
  @Get('shoots/:slug')
  getShoot(@Param('slug') slug: string, @CurrentUser() user?: User) {
    return this.shootsService.getBySlug(slug, user);
  }

  @Post('shoots')
  @Roles('admin')
  createShoot(@Body() dto: ShootInputDto) {
    return this.shootsService.create(dto);
  }

  @Put('shoots/:id')
  @Roles('admin')
  updateShoot(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ShootInputDto,
  ) {
    return this.shootsService.update(id, dto);
  }

  @Delete('shoots/:id')
  @Roles('admin')
  async removeShoot(@Param('id', ParseUUIDPipe) id: string) {
    await this.shootsService.remove(id);
    return { success: true };
  }

  @Public()
  @Get('tags')
  listTags(@Query() query: ListShootsQueryDto, @CurrentUser() user?: User) {
    // Empty tags are the admin's problem to tidy; a public filter that is
    // guaranteed to return nothing is worse than no filter.
    return this.tagsService.list(
      user?.role === 'admin' && Boolean(query.includeEmpty),
    );
  }

  @Post('tags')
  @Roles('admin')
  createTag(@Body() dto: TagInputDto) {
    return this.tagsService.create(dto);
  }

  @Put('tags/:id')
  @Roles('admin')
  updateTag(@Param('id', ParseUUIDPipe) id: string, @Body() dto: TagInputDto) {
    return this.tagsService.update(id, dto);
  }

  @Delete('tags/:id')
  @Roles('admin')
  async removeTag(@Param('id', ParseUUIDPipe) id: string) {
    await this.tagsService.remove(id);
    return { success: true };
  }

  // ---- one shot --------------------------------------------------------

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

  @Post('bulk')
  @Roles('admin')
  createMany(@Body() dto: BulkCreateGalleryItemsDto) {
    return this.galleryService.createMany(dto.items);
  }

  /**
   * Fills in placeholders for the archive that predates them.
   *
   * A one-shot for the existing archive rather than a migration: it needs
   * Cloudinary, not the database, and a migration that depends on a third
   * party is a migration that fails on a bad afternoon.
   */
  @Post('placeholders')
  @Roles('admin')
  @HttpCode(200)
  backfillPlaceholders() {
    return this.placeholders.backfill();
  }

  @Patch('reorder')
  @Roles('admin')
  @HttpCode(200)
  async reorder(@Body() dto: ReorderGalleryDto) {
    await this.galleryService.reorder(dto.items);
    return { success: true, updated: dto.items.length };
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
