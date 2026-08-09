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
}
