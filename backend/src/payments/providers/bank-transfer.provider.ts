import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order } from '../../orders/order.entity';
import type {
  PaymentMethod,
  PaymentProvider,
  PaymentStart,
} from '../payment.types';

/**
 * Manual bank transfer.
 *
 * Available as soon as the shop's account details are in the environment —
 * there is no integration to build, only instructions to show and a human to
 * confirm the money landed.
 */
@Injectable()
export class BankTransferProvider implements PaymentProvider {
  readonly method: PaymentMethod = 'bank_transfer';
  readonly label = 'Bank transfer';

  constructor(private readonly config: ConfigService) {}

  private get accountName(): string | undefined {
    return this.config.get<string>('BANK_ACCOUNT_NAME');
  }

  private get iban(): string | undefined {
    return this.config.get<string>('BANK_ACCOUNT_IBAN');
  }

  private get bankName(): string | undefined {
    return this.config.get<string>('BANK_ACCOUNT_BANK');
  }

  note(): string {
    return this.isConfigured()
      ? 'We send the account details with your confirmation. Your order ships once the transfer lands.'
      : 'Not set up yet — the shop has no bank details configured.';
  }

  isConfigured(): boolean {
    return Boolean(this.accountName && this.iban);
  }

  start(order: Order): Promise<PaymentStart> {
    return Promise.resolve({
      kind: 'instructions',
      heading: 'Transfer to complete your order',
      lines: [
        `Account name: ${this.accountName ?? '—'}`,
        `IBAN: ${this.iban ?? '—'}`,
        ...(this.bankName ? [`Bank: ${this.bankName}`] : []),
        // The reference is what lets a human match a bank statement line back
        // to an order without asking the customer.
        `Reference: ${order.id.slice(0, 8).toUpperCase()}`,
      ],
    });
  }
}
