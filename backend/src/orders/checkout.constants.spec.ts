import {
  parseThresholdCents,
  shippingAfterThreshold,
} from './checkout.constants';

describe('shippingAfterThreshold', () => {
  it('charges the normal fee below the threshold', () => {
    expect(shippingAfterThreshold('tbilisi', 9999, 10000)).toBe(500);
  });

  it('is free at exactly the threshold', () => {
    expect(shippingAfterThreshold('tbilisi', 10000, 10000)).toBe(0);
    expect(shippingAfterThreshold('regions', 10000, 10000)).toBe(0);
  });

  it('is free above it', () => {
    expect(shippingAfterThreshold('regions', 50000, 10000)).toBe(0);
  });

  it('is off entirely when the threshold is zero', () => {
    // The shipped default: nothing changes until someone sets a number.
    expect(shippingAfterThreshold('tbilisi', 999999, 0)).toBe(500);
  });

  it('leaves pickup free either way', () => {
    expect(shippingAfterThreshold('pickup', 0, 10000)).toBe(0);
    expect(shippingAfterThreshold('pickup', 999999, 0)).toBe(0);
  });
});

describe('parseThresholdCents', () => {
  it('reads a number', () => {
    expect(parseThresholdCents('15000')).toBe(15000);
  });

  it('treats anything unusable as off rather than as free shipping', () => {
    expect(parseThresholdCents('0')).toBe(0);
    expect(parseThresholdCents('-1')).toBe(0);
    expect(parseThresholdCents('abc')).toBe(0);
    expect(parseThresholdCents(undefined)).toBe(0);
  });
});
