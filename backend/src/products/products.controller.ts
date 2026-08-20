import {
  BadRequestException,
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
  CreateProductDto,
  ListProductsQueryDto,
  RateFitDto,
  UpdateProductDto,
} from './dto/products.dto';
import { FitService } from './fit.service';
import { isFitValue } from './fit';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly fitService: FitService,
  ) {}

  @Public()
  @Get()
  list(@Query() query: ListProductsQueryDto, @CurrentUser() user?: User) {
    return this.productsService.list(query, user);
  }

  @Public()
  @Get(':idOrSlug')
  getOne(@Param('idOrSlug') idOrSlug: string, @CurrentUser() user?: User) {
    return this.productsService.getByIdOrSlug(idOrSlug, user);
  }

  /**
   * Record how this piece fits.
   *
   * Signed in and having bought it — the service enforces the second part.
   * Both are the point: a fit rating from someone who never wore the garment
   * is worth less than no rating at all.
   */
  @Post(':id/fit')
  rateFit(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RateFitDto,
    @CurrentUser() user: User,
  ) {
    // The DTO already restricts the value; this narrows it for the compiler
    // rather than casting.
    if (!isFitValue(dto.value)) {
      throw new BadRequestException('Unknown fit value');
    }
    return this.fitService.rate(id, user.id, dto.value);
  }

  @Delete(':id/fit')
  clearFit(@Param('id', ParseUUIDPipe) id: string, @CurrentUser() user: User) {
    return this.fitService.remove(id, user.id);
  }

  @Post()
  @Roles('admin')
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Put(':id')
  @Roles('admin')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateProductDto,
  ) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @Roles('admin')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.productsService.remove(id);
  }
}
