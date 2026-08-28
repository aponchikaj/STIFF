import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CatalogService } from './catalog.service';

/**
 * Public reads: an anonymous visitor can browse what is playable and even load
 * a chart for the demo gate. What they cannot do is open a run — that needs a
 * session, because a score without an owner is not a score.
 */
@Controller('game')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('songs')
  @Public()
  songs() {
    return this.catalog.listSongs();
  }

  @Get('charts/:id')
  @Public()
  chart(@Param('id', ParseUUIDPipe) id: string) {
    return this.catalog.chart(id);
  }
}
