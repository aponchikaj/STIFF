import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Host root — UptimeRobot points at https://stiff-i3nq.onrender.com with no path. */
  @Public()
  @Get()
  rootHealth() {
    return this.appService.health();
  }

  /** Prefixed as /api/health (Render healthCheckPath, detailed probes). */
  @Public()
  @Get('health')
  health() {
    return this.appService.health();
  }
}
