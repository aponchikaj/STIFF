import { ADVERSARIAL_CORPUS, SHOULD_PASS } from './adversarial-corpus';
import {
  EXCLUSION_CATEGORIES,
  screen,
  screenTask,
  requiresAdultsOnly,
  isGuard,
} from './exclusions';

/**
 * The safety screen.
 *
 * Spec §11 asks for an adversarial corpus that runs in CI and fails closed on
 * every entry. This is that test. It is the gate between a model writing a good
 * task that is also illegal and that task reaching someone's phone, so it is
 * deliberately the most paranoid file in the module.
 */

describe('the adversarial corpus', () => {
  /**
   * The load-bearing assertion. If one of these starts passing, the screen has
   * regressed and a season should not ship until it is understood.
   */
  it.each(ADVERSARIAL_CORPUS.map((e) => [e.id, e] as const))(
    'rejects %s',
    (_id, entry) => {
      const result = screen(entry.task);
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations.length).toBeGreaterThan(0);
      }
    },
  );

  /** Every violation has to tell the writer what to do about it. */
  it('explains every rejection', () => {
    for (const entry of ADVERSARIAL_CORPUS) {
      const result = screen(entry.task);
      if (result.ok) continue;
      for (const violation of result.violations) {
        expect(violation.remedy.length).toBeGreaterThan(10);
        expect(violation.matched.length).toBeGreaterThan(0);
      }
    }
  });

  /**
   * A screen that rejects everything is trivially safe and useless — writers
   * switch it off. These are the approved tasks and must survive.
   */
  it.each(SHOULD_PASS.map((e) => [e.id, e] as const))(
    'accepts %s',
    (_id, entry) => {
      const result = screen(entry.task);
      if (!result.ok) {
        throw new Error(
          `over-blocked: ${result.violations.map((v) => `${v.category} on "${v.matched}"`).join(', ')}`,
        );
      }
      expect(result.ok).toBe(true);
    },
  );

  it('covers every excluded category at least once', () => {
    const covered = new Set(
      ADVERSARIAL_CORPUS.flatMap((entry) => {
        const result = screen(entry.task);
        return result.ok ? [] : result.violations.map((v) => v.category);
      }),
    );
    for (const category of EXCLUSION_CATEGORIES) {
      expect(covered.has(category)).toBe(true);
    }
  });
});

describe('screenTask', () => {
  it('reads the criteria, not just the brief', () => {
    const result = screenTask({
      brief: 'Photograph the skyline.',
      criteria: [{ assert: 'The player is standing on a rooftop.' }],
    });
    expect(result.ok).toBe(false);
  });

  /**
   * The three redeemable categories, each mapping to a real approved task.
   * Everything else is a flat no — there is no guard that makes trespass legal.
   */
  describe('guards redeem exactly three categories', () => {
    it('`no_contact` redeems touching', () => {
      const brief = 'Hand your jacket to a stranger — do not touch them.';
      expect(screenTask({ brief }).ok).toBe(false);
      expect(screenTask({ brief, guards: ['no_contact'] }).ok).toBe(true);
    });

    it('`outerwear_only` redeems nudity', () => {
      const brief = 'Strip off your outer layer and trade it.';
      expect(screenTask({ brief }).ok).toBe(false);
      expect(screenTask({ brief, guards: ['outerwear_only'] }).ok).toBe(true);
    });

    it('`no_obstruction` redeems disruption', () => {
      const brief = 'Stand still near a doorway for sixty seconds.';
      expect(screenTask({ brief }).ok).toBe(false);
      expect(screenTask({ brief, guards: ['no_obstruction'] }).ok).toBe(true);
    });

    it('no guard redeems trespass, traffic, heights, water, fire or stunts', () => {
      const everyGuard = [
        'adults_only',
        'no_contact',
        'outerwear_only',
        'no_obstruction',
        'consent_on_record',
        'own_wardrobe',
      ];
      const unredeemable = [
        'Climb the fence onto private property.',
        'Stand in the road as traffic passes.',
        'Film from the rooftop ledge.',
        'Swim out into the lake.',
        'Light a match on camera.',
        'Backflip off the bench.',
      ];
      for (const brief of unredeemable) {
        expect(screenTask({ brief, guards: everyGuard }).ok).toBe(false);
      }
    });
  });

  /**
   * Substring matching turns "class" into trespass and "waterproof" into
   * water. A screen that cries wolf gets switched off, so the boundaries
   * matter as much as the patterns.
   */
  describe('word boundaries', () => {
    it.each([
      'Wear a waterproof jacket and stand in the square.',
      'Photograph nine things in your classroom.',
      'Find something with a matchbox pattern printed on it.',
      'Shoot the passage between two buildings.',
    ])('does not trip on %s', (brief) => {
      const result = screenTask({ brief });
      if (!result.ok) {
        throw new Error(
          `false positive: ${result.violations.map((v) => v.category).join(', ')}`,
        );
      }
      expect(result.ok).toBe(true);
    });
  });

  it('fails closed on an empty brief rather than passing by default', () => {
    expect(screenTask({ brief: '' }).ok).toBe(false);
    expect(screenTask({ brief: '   \n  ' }).ok).toBe(false);
  });

  it('reports every category a task violates, not just the first', () => {
    const result = screenTask({
      brief: 'Climb onto the roof, light a match, and buy a drink.',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const categories = result.violations.map((v) => v.category);
      expect(categories).toEqual(
        expect.arrayContaining(['heights', 'fire', 'spending']),
      );
    }
  });
});

describe('requiresAdultsOnly', () => {
  it('is true whenever another person is involved', () => {
    expect(requiresAdultsOnly({ brief: 'Ask a stranger to hold this.' })).toBe(
      true,
    );
    expect(
      requiresAdultsOnly({ brief: 'Get someone else to choose your outfit.' }),
    ).toBe(true);
  });

  it('is false for a solo task', () => {
    expect(
      requiresAdultsOnly({ brief: 'Photograph nine objects of one colour.' }),
    ).toBe(false);
  });

  /**
   * The guard the spec says is most likely to be violated accidentally, so it
   * is enforced structurally rather than trusted to the wording.
   */
  it('makes a stranger-facing task fail without the guard', () => {
    const brief = 'Ask a stranger to repeat the season phrase.';
    expect(screen({ brief, guards: ['consent_on_record'] }).ok).toBe(false);
    expect(
      screen({ brief, guards: ['consent_on_record', 'adults_only'] }).ok,
    ).toBe(true);
  });
});

describe('isGuard', () => {
  it('knows the six', () => {
    expect(isGuard('adults_only')).toBe(true);
    expect(isGuard('no_contact')).toBe(true);
    expect(isGuard('anything_goes')).toBe(false);
    expect(isGuard('')).toBe(false);
  });
});
