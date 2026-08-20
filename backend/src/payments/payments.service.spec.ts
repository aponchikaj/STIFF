import { BadRequestException, NotImplementedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Order } from '../orders/order.entity';
import { PaymentsService } from './payments.service';
import { BankTransferProvider } from './providers/bank-transfer.provider';
import { BogProvider, TbcProvider } from './providers/card.provider';
import { CodProvider } from './providers/cod.provider';

/** A ConfigService backed by a plain object, so each test states its own env. */
function configWith(env: Record<string, string>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

function build(env: Record<string, string> = {}) {
  const config = configWith(env);
  return new PaymentsService(
    config,
    new CodProvider(),
    new BankTransferProvider(config),
    new TbcProvider(config),
    new BogProvider(config),
  );
}

const order = { id: 'ffffffff-1111-2222-3333-444444444444' } as Order;

function withMethod(method: string): Order {
  return { ...order, paymentMethod: method } as Order;
}

describe('PaymentsService', () => {
  describe('availability with nothing configured', () => {
    const service = build();

    it('still offers cash on delivery — it needs no merchant account', () => {
      expect(service.isAvailable('cod')).toBe(true);
    });

    it('withholds bank transfer until account details exist', () => {
      expect(service.isAvailable('bank_transfer')).toBe(false);
    });

    it('withholds both card acquirers', () => {
      expect(service.isAvailable('card_tbc')).toBe(false);
      expect(service.isAvailable('card_bog')).toBe(false);
    });

    it('lists unavailable methods rather than hiding them, so the UI can say "coming soon"', () => {
      const methods = service.availability().map((m) => m.method);
      expect(methods).toEqual(['cod', 'bank_transfer', 'card_tbc', 'card_bog']);
    });
  });

  describe('partial configuration', () => {
    it('enables bank transfer once name and IBAN are set', () => {
      const service = build({
        BANK_ACCOUNT_NAME: 'STIFF LLC',
        BANK_ACCOUNT_IBAN: 'GE00TB0000000000000000',
      });
      expect(service.isAvailable('bank_transfer')).toBe(true);
    });

    it('does not enable bank transfer on a name alone', () => {
      const service = build({ BANK_ACCOUNT_NAME: 'STIFF LLC' });
      expect(service.isAvailable('bank_transfer')).toBe(false);
    });

    it('enables one acquirer without enabling the other', () => {
      const service = build({
        TBC_CLIENT_ID: 'id',
        TBC_CLIENT_SECRET: 'secret',
      });
      expect(service.isAvailable('card_tbc')).toBe(true);
      expect(service.isAvailable('card_bog')).toBe(false);
    });

    it('needs both halves of a credential pair', () => {
      const service = build({ BOG_CLIENT_ID: 'id' });
      expect(service.isAvailable('card_bog')).toBe(false);
    });
  });

  describe('start', () => {
    it('refuses a method that is not configured, before any money or stock moves', async () => {
      const service = build();
      await expect(
        service.start(withMethod('card_tbc')),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('collects nothing up front for cash on delivery', async () => {
      const service = build();
      await expect(service.start(withMethod('cod'))).resolves.toEqual({
        kind: 'on_delivery',
      });
    });

    it('gives bank transfer instructions carrying a reference to match the statement', async () => {
      const service = build({
        BANK_ACCOUNT_NAME: 'STIFF LLC',
        BANK_ACCOUNT_IBAN: 'GE00TB0000000000000000',
      });
      const outcome = await service.start(withMethod('bank_transfer'));
      expect(outcome.kind).toBe('instructions');
      if (outcome.kind !== 'instructions') throw new Error('unreachable');
      expect(outcome.lines.join('\n')).toContain('GE00TB0000000000000000');
      expect(outcome.lines.join('\n')).toContain('FFFFFFFF');
    });

    it('throws rather than pretending, when an acquirer is configured but unimplemented', async () => {
      const service = build({
        TBC_CLIENT_ID: 'id',
        TBC_CLIENT_SECRET: 'secret',
      });
      await expect(
        service.start(withMethod('card_tbc')),
      ).rejects.toBeInstanceOf(NotImplementedException);
    });

    it('rejects a method that does not exist', async () => {
      const service = build();
      await expect(service.start(withMethod('bitcoin'))).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });
  });

  describe('test mode', () => {
    const service = build({ PAYMENTS_TEST_MODE: 'true' });

    it('makes both acquirers selectable without credentials', () => {
      expect(service.isAvailable('card_tbc')).toBe(true);
      expect(service.isAvailable('card_bog')).toBe(true);
    });

    it('flags them so the UI can say no money will move', () => {
      const cards = service
        .availability()
        .filter((m) => m.method.startsWith('card_'));
      expect(cards.every((m) => m.testMode)).toBe(true);
    });

    it('does not flag methods that take real money either way', () => {
      const cod = service.availability().find((m) => m.method === 'cod');
      expect(cod?.testMode).toBe(false);
    });

    it('simulates the payment instead of contacting a gateway', async () => {
      const outcome = await service.start(withMethod('card_tbc'));
      expect(outcome.kind).toBe('simulated');
      if (outcome.kind !== 'simulated') throw new Error('unreachable');
      expect(outcome.reference).toMatch(/^test_card_tbc_[0-9a-f]{16}$/);
    });
  });

  describe('settlesImmediately — the one rule every integration shares', () => {
    const service = build();

    it('is true only for a simulated payment', () => {
      expect(
        service.settlesImmediately({ kind: 'simulated', reference: 'r' }),
      ).toBe(true);
    });

    it('is false for everything that still needs a human or a gateway', () => {
      expect(service.settlesImmediately({ kind: 'on_delivery' })).toBe(false);
      expect(
        service.settlesImmediately({
          kind: 'instructions',
          heading: 'h',
          lines: [],
        }),
      ).toBe(false);
      expect(
        service.settlesImmediately({
          kind: 'redirect',
          url: 'https://bank.example',
          reference: 'r',
        }),
      ).toBe(false);
    });
  });
});
