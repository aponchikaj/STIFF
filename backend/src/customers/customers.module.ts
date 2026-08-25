import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AddressesService } from './addresses.service';
import { CustomersController } from './customers.controller';
import { UserAddress } from './user-address.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserAddress])],
  controllers: [CustomersController],
  providers: [AddressesService],
  exports: [AddressesService],
})
export class CustomersModule {}
