import { Module } from '@nestjs/common';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { BogProvider, TbcProvider } from './providers/card.provider';
import { CodProvider } from './providers/cod.provider';

@Module({
  controllers: [PaymentsController],
  providers: [
    PaymentsService,
    CodProvider,
    BankTransferProvider,
    TbcProvider,
    BogProvider,
  ],
  exports: [PaymentsService],
})
export class PaymentsModule {}
