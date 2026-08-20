import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * What checkout should render. The frontend used to hardcode this list and
   * which entries were live; now it asks, so turning an acquirer on is a
   * config change rather than a deploy of both apps.
   */
  @Public()
  @Get('methods')
  methods() {
    return {
      methods: this.paymentsService.availability(),
      testMode: this.paymentsService.testMode,
    };
  }
}
