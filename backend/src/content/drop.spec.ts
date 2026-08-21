import { DropConfig, nextTransitionAt, resolveDropState } from './drop';

const NOON = new Date('2026-09-01T12:00:00.000Z');

function config(overrides: Partial<DropConfig> = {}): DropConfig {
  return {
    enabled: true,
    soldOut: false,
    dropAt: '',
    endsAt: '',
    ...overrides,
  };
}

describe('resolveDropState', () => {
  it('is off when the switch is off, whatever the dates say', () => {
    // The switch is the admin's way out of a drop that is going wrong. It has
    // to beat a schedule that says the thing is live right now.
    expect(
      resolveDropState(
        config({
          enabled: false,
          dropAt: '2026-08-01T00:00:00.000Z',
          soldOut: true,
        }),
        NOON,
      ),
    ).toBe('off');
  });

  it('is sold out when called sold out, even mid-window', () => {
    expect(
      resolveDropState(
        config({
          soldOut: true,
          dropAt: '2026-08-01T00:00:00.000Z',
          endsAt: '2026-12-01T00:00:00.000Z',
        }),
        NOON,
      ),
    ).toBe('sold_out');
  });

  it('teases while the opening is still ahead', () => {
    expect(
      resolveDropState(config({ dropAt: '2026-09-01T18:00:00.000Z' }), NOON),
    ).toBe('teaser');
  });

  it('goes live on the exact second, not after it', () => {
    // A drop that opens "at 18:00" and is still teasing at 18:00:00 is the
    // complaint every drop gets.
    const opensNow = config({ dropAt: NOON.toISOString() });
    expect(resolveDropState(opensNow, NOON)).toBe('live');
    expect(resolveDropState(opensNow, new Date(NOON.getTime() - 1))).toBe(
      'teaser',
    );
  });

  it('ends on the exact second too', () => {
    const closesNow = config({ endsAt: NOON.toISOString() });
    expect(resolveDropState(closesNow, NOON)).toBe('ended');
    expect(resolveDropState(closesNow, new Date(NOON.getTime() - 1))).toBe(
      'live',
    );
  });

  it('is live when it is on and nothing is scheduled', () => {
    expect(resolveDropState(config(), NOON)).toBe('live');
  });

  it('treats an unreadable date as no date rather than throwing', () => {
    // These strings come from a form. A typo should not take the hero down.
    expect(resolveDropState(config({ dropAt: 'next tuesday' }), NOON)).toBe(
      'live',
    );
    expect(resolveDropState(config({ endsAt: 'soon' }), NOON)).toBe('live');
  });

  it('ends rather than teases when the window is back to front', () => {
    // An admin who sets an end before the start has made a mistake; closed is
    // the safe reading of it, and open would sell stock that is not there.
    expect(
      resolveDropState(
        config({
          dropAt: '2026-10-01T00:00:00.000Z',
          endsAt: '2026-08-01T00:00:00.000Z',
        }),
        NOON,
      ),
    ).toBe('ended');
  });
});

describe('nextTransitionAt', () => {
  it('points a teaser at its opening', () => {
    expect(
      nextTransitionAt(config({ dropAt: '2026-09-01T18:00:00.000Z' }), NOON),
    ).toBe('2026-09-01T18:00:00.000Z');
  });

  it('points a live drop at its close', () => {
    expect(
      nextTransitionAt(config({ endsAt: '2026-09-02T00:00:00.000Z' }), NOON),
    ).toBe('2026-09-02T00:00:00.000Z');
  });

  it('has nothing to wait for when the drop is open-ended', () => {
    // Null is what stops the hero polling once an hour for the rest of time.
    expect(nextTransitionAt(config(), NOON)).toBeNull();
  });

  it('has nothing to wait for once it is over', () => {
    expect(nextTransitionAt(config({ soldOut: true }), NOON)).toBeNull();
    expect(nextTransitionAt(config({ enabled: false }), NOON)).toBeNull();
  });
});
