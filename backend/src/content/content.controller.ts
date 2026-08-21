import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CONTENT_BLOCKS } from './content.registry';
import { ContentService } from './content.service';
import { InstagramService } from './instagram.service';
import { UpdateContentDto } from './dto/content.dto';

@Controller('content')
export class ContentController {
  constructor(
    private readonly contentService: ContentService,
    private readonly instagramService: InstagramService,
  ) {}

  /** The registry itself — drives the admin form without hardcoding fields. */
  @Public()
  @Get('catalog')
  catalog() {
    return { blocks: CONTENT_BLOCKS };
  }

  /**
   * The drop, with its state already worked out.
   *
   * Declared before `@Get(':key')`, which matches any single segment and would
   * otherwise swallow "drop" and reject it as an unknown content key.
   *
   * The state is resolved here rather than in the browser so every visitor
   * gets the same answer — a wrong clock on someone's laptop should not open
   * the drop early while the shop disagrees.
   */
  @Public()
  @Get('drop')
  drop() {
    return this.contentService.drop();
  }

  /**
   * The enforced policy, for the House rules page.
   *
   * Declared above `@Get(':key')` for the same reason `drop` is.
   */
  /**
   * The latest Instagram posts, cached on this side.
   *
   * The site never talks to Instagram itself: the access token lives here, and
   * a token that reaches a browser is a token anybody can read.
   */
  @Public()
  @Get('instagram')
  instagram() {
    return this.instagramService.strip();
  }

  @Public()
  @Get('policy')
  policy() {
    return this.contentService.policy();
  }

  @Public()
  @Get()
  getAll() {
    return this.contentService.getAll();
  }

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
