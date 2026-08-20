import { Injectable, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'crypto';
import type { Order } from '../../orders/order.entity';
import type {
  PaymentMethod,
  PaymentProvider,
  PaymentStart,
} from '../payment.types';

/**
 * Shared behaviour for the two Georgian card acquirers.
 *
 * Both work the same way from the shop's side: exchange credentials for a
 * token, register the order, send the buyer to a hosted payment page, and get
 * a signed callback when they come back. What differs is endpoints, field
 * names and the callback signature — and those are not implemented here.
 *
 * `startLive` deliberately throws. Writing an integration against a bank API
 * without credentials or sandbox access would produce code that looks finished
 * and fails in production; a clear error at the point of use is more honest.
 * Everything around it — availability, method selection, the redirect contract,
 * the callback route, the order transition — is real and exercised by
 * `PAYMENTS_TEST_MODE`.
 */
@Injectable()
export abstract class CardProvider implements PaymentProvider {
  abstract readonly method: PaymentMethod;
  abstract readonly label: string;
  /** Env prefix, e.g. `TBC` reads TBC_CLIENT_ID / TBC_CLIENT_SECRET. */
  protected abstract readonly envPrefix: string;
  /** Where to finish the integration. */
  protected abstract readonly docsHint: string;

  constructor(protected readonly config: ConfigService) {}

  protected get clientId(): string | undefined {
    return this.config.get<string>(`${this.envPrefix}_CLIENT_ID`);
  }

  protected get clientSecret(): string | undefined {
    return this.config.get<string>(`${this.envPrefix}_CLIENT_SECRET`);
  }

  get testMode(): boolean {
    return this.config.get<string>('PAYMENTS_TEST_MODE') === 'true';
  }

  isConfigured(): boolean {
    // Test mode makes the option selectable without a merchant account, so the
    // whole checkout flow can be walked end to end before the contract exists.
    if (this.testMode) return true;
    return Boolean(this.clientId && this.clientSecret);
  }

  note(): string {
    if (this.testMode) {
      return 'Test mode — no real payment is taken and no card is charged.';
    }
    return this.clientId && this.clientSecret
      ? `Pay by card via ${this.label}.`
      : 'Card payment is coming soon.';
  }

  async start(order: Order): Promise<PaymentStart> {
    if (this.testMode) {
      return {
        kind: 'simulated',
        reference: `test_${this.method}_${randomBytes(8).toString('hex')}`,
      };
    }
    return this.startLive(order);
  }

  protected startLive(order: Order): Promise<PaymentStart> {
    void order;
    throw new NotImplementedException(
      `${this.label} is configured but the integration is not finished. ${this.docsHint}`,
    );
  }
}

@Injectable()
export class TbcProvider extends CardProvider {
  readonly method: PaymentMethod = 'card_tbc';
  readonly label = 'Card — TBC Bank';
  protected readonly envPrefix = 'TBC';
  protected readonly docsHint =
    'Implement startLive() against TBC e-commerce once merchant credentials exist.';
}

@Injectable()
export class BogProvider extends CardProvider {
  readonly method: PaymentMethod = 'card_bog';
  readonly label = 'Card — Bank of Georgia';
  protected readonly envPrefix = 'BOG';
  protected readonly docsHint =
    'Implement startLive() against the BOG e-commerce API once merchant credentials exist.';
}
