import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { VerifiedGuard } from '../common/guards/verified.guard';
import { User } from '../users/user.entity';
import {
  BuyNowDto,
  CheckoutDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto,
} from './dto/orders.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  @Post('checkout')
  @UseGuards(VerifiedGuard)
  checkout(@CurrentUser() user: User, @Body() dto: CheckoutDto) {
    return this.ordersService.checkout(user, dto);
  }

  @Post('buy-now')
  @UseGuards(VerifiedGuard)
  buyNow(@CurrentUser() user: User, @Body() dto: BuyNowDto) {
    return this.ordersService.buyNow(user, dto);
  }

  @Get()
  @Roles('admin')
  adminList(@Query() query: ListOrdersQueryDto) {
    return this.ordersService.adminList(query);
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.ordersService.getOne(id, user);
  }

  @Patch(':id/status')
  @Roles('admin')
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrderStatusDto,
  ) {
    return this.ordersService.updateStatus(id, dto);
  }
}
