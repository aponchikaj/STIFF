import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/order.entity';
import {
  PAYMENT_METHODS,
  PaymentAvailability,
  PaymentMethod,
  PaymentProvider,
  PaymentStart,
} from './payment.types';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { BogProvider, TbcProvider } from './providers/card.provider';
import { CodProvider } from './providers/cod.provider';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly providers: Map<PaymentMethod, PaymentProvider>;

  constructor(
    private readonly config: ConfigService,
    cod: CodProvider,
    bank: BankTransferProvider,
    tbc: TbcProvider,
    bog: BogProvider,
  ) {
    this.providers = new Map(
      [cod, bank, tbc, bog].map((p) => [p.method, p] as const),
    );
  }

  get testMode(): boolean {
    return this.config.get<string>('PAYMENTS_TEST_MODE') === 'true';
  }

  /**
   * What checkout may offer. Unconfigured methods are returned as unavailable
   * rather than omitted, so the UI can show "coming soon" instead of quietly
   * dropping an option people are looking for.
   */
  availability(): PaymentAvailability[] {
    return PAYMENT_METHODS.map((method) => {
      const provider = this.require(method);
      const isCard = method.startsWith('card_');
      return {
        method,
        label: provider.label,
        note: provider.note(),
        available: provider.isConfigured(),
        testMode: isCard && this.testMode,
      };
    });
  }

  isAvailable(method: PaymentMethod): boolean {
    return this.require(method).isConfigured();
  }

  /**
   * Called inside checkout, after the order row exists and stock is committed.
   *
   * Throwing here rolls the order back, which is the behaviour we want: an
   * order nobody can pay for is worse than a failed checkout.
   */
  async start(order: Order): Promise<PaymentStart> {
    const method = order.paymentMethod;
    const provider = this.require(method);
    if (!provider.isConfigured()) {
      throw new BadRequestException(
        `${provider.label} is not available right now. Pick another payment method.`,
      );
    }
    const outcome = await provider.start(order);
    if (outcome.kind === 'simulated') {
      this.logger.warn(
        `Order ${order.id} marked paid by PAYMENTS_TEST_MODE — no money moved.`,
      );
    }
    return outcome;
  }

  /**
   * Whether this outcome means the money is in.
   *
   * Only the service decides this, never a provider — it is the one rule that
   * must stay identical across every integration.
   */
  settlesImmediately(outcome: PaymentStart): boolean {
    return outcome.kind === 'simulated';
  }

  private require(method: PaymentMethod): PaymentProvider {
    const provider = this.providers.get(method);
    if (!provider) throw new BadRequestException('Unknown payment method');
    return provider;
  }
}
