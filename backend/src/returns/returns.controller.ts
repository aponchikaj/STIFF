import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../common/types/authenticated-request';
import { OrdersService } from '../orders/orders.service';
import {
  CreateReturnDto,
  ListReturnsQueryDto,
  ResolveReturnDto,
} from './dto/returns.dto';
import { ReturnsService } from './returns.service';

@Controller('returns')
export class ReturnsController {
  constructor(
    private readonly returnsService: ReturnsService,
    private readonly ordersService: OrdersService,
  ) {}

  @Get()
  @Roles('admin')
  adminList(@Query() query: ListReturnsQueryDto) {
    return this.returnsService.adminList(query);
  }

  /**
   * Public for the same reason `GET /orders/:id` is: a guest has only the
   * order id, and `OrdersService.getOne` still refuses an account order to an
   * anonymous caller.
   */
  @Public()
  @Get('order/:orderId')
  async forOrder(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: Request,
  ) {
    const user = (req as AuthenticatedRequest).user ?? null;
    const order = await this.ordersService.getOne(orderId, user);
    const [requests, eligibility] = await Promise.all([
      this.returnsService.listForOrder(order.id),
      this.returnsService.eligibility(order),
    ]);
    return { requests, eligibility };
  }

  @Public()
  @Post('order/:orderId')
  async create(
    @Param('orderId', ParseUUIDPipe) orderId: string,
    @Req() req: Request,
    @Body() dto: CreateReturnDto,
  ) {
    const user = (req as AuthenticatedRequest).user ?? null;
    const order = await this.ordersService.getOne(orderId, user);
    return this.returnsService.create(order, dto);
  }

  @Get(':id')
  @Roles('admin')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.returnsService.getOne(id);
  }

  @Patch(':id')
  @Roles('admin')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ResolveReturnDto,
  ) {
    return this.returnsService.resolve(id, dto);
  }
}
