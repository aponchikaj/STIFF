import { Injectable } from '@nestjs/common';
import type {
  PaymentMethod,
  PaymentProvider,
  PaymentStart,
} from '../payment.types';

/** Cash on delivery. Always available — it needs no merchant account. */
@Injectable()
export class CodProvider implements PaymentProvider {
  readonly method: PaymentMethod = 'cod';
  readonly label = 'Pay on delivery';

  note(): string {
    return 'Pay the courier in cash when your order arrives.';
  }

  isConfigured(): boolean {
    return true;
  }

  start(): Promise<PaymentStart> {
    // The order stays pending until someone hands over the money; the admin
    // marks it paid then. Nothing to collect at checkout.
    return Promise.resolve({ kind: 'on_delivery' });
  }
}
