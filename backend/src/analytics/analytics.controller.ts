import {
  BadRequestException,
  Controller,
  DefaultValuePipe,
  Get,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { Roles } from '../common/decorators/roles.decorator';
import { AnalyticsService, TimeseriesMetric } from './analytics.service';

@Controller('admin/analytics')
@Roles('admin')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('overview')
  overview() {
    return this.analyticsService.overview();
  }

  /**
   * How far down a page people got, and how the intro overlay performed.
   *
   * `path` defaults to the home page because that is the page with seven acts
   * and no evidence about which of them anybody reaches.
   */
  @Get('scroll')
  scroll(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('path') path?: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }
    return this.analyticsService.scrollReach(path || '/', from, to);
  }

  @Get('intro')
  intro(@Query('from') from: string, @Query('to') to: string) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }
    return this.analyticsService.introReach(from, to);
  }

  @Get('timeseries')
  timeseries(
    @Query('from') from: string,
    @Query('to') to: string,
    @Query('metric') metric: string,
  ) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }
    const valid: TimeseriesMetric[] = ['revenue', 'orders', 'signups'];
    if (!valid.includes(metric as TimeseriesMetric)) {
      throw new BadRequestException(
        `metric must be one of: ${valid.join(', ')}`,
      );
    }
    return this.analyticsService.timeseries(
      from,
      to,
      metric as TimeseriesMetric,
    );
  }

  @Get('top-products')
  topProducts(
    @Query('limit', new DefaultValuePipe(5), ParseIntPipe) limit: number,
  ) {
    return this.analyticsService.topProducts(limit);
  }

  @Get('traffic')
  traffic(@Query('from') from: string, @Query('to') to: string) {
    if (!from || !to) {
      throw new BadRequestException('from and to are required (YYYY-MM-DD)');
    }
    return this.analyticsService.traffic(from, to);
  }
}
