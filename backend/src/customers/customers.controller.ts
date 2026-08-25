import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Public } from '../common/decorators/public.decorator';
import { GEORGIA_REGIONS } from '../orders/georgia';
import { User } from '../users/user.entity';
import { AddressesService } from './addresses.service';
import { SaveAddressDto } from './dto/customers.dto';

@Controller()
export class CustomersController {
  constructor(private readonly addressesService: AddressesService) {}

  // ------------------------------------------------------------ addresses --

  @Get('addresses')
  list(@CurrentUser() user: User) {
    return this.addressesService.list(user.id);
  }

  @Post('addresses')
  create(@CurrentUser() user: User, @Body() dto: SaveAddressDto) {
    return this.addressesService.create(user.id, dto);
  }

  @Patch('addresses/:id')
  update(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SaveAddressDto,
  ) {
    return this.addressesService.update(user.id, id, dto);
  }

  @Delete('addresses/:id')
  async remove(
    @CurrentUser() user: User,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    await this.addressesService.remove(user.id, id);
    return { success: true };
  }

  /** The regions the checkout dropdown offers. */
  @Public()
  @Get('addresses/regions')
  regions() {
    return { regions: GEORGIA_REGIONS };
  }
}
