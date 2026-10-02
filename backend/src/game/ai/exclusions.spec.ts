import { ADVERSARIAL_CORPUS, SHOULD_PASS } from './adversarial-corpus';
import { BLOCKED_TASK_TYPES } from './blocklist';
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

/**
 * The screen is the floor under the blocklist. Every type the blocklist names
 * has a regex rule of the same name, so a task the reviewer agent would refuse
 * for it is caught even when the reviewer is down. `nudity` is the one extra:
 * an older, narrower rule the `sexual` type now subsumes, kept because it
 * carries the `outerwear_only` redemption.
 */
describe('the blocklist and the screen agree', () => {
  it('enforces every blocked task type by name', () => {
    for (const type of BLOCKED_TASK_TYPES) {
      expect(EXCLUSION_CATEGORIES).toContain(type.id);
    }
  });

  it('has no screen category the blocklist does not name, except nudity', () => {
    const ids = new Set(BLOCKED_TASK_TYPES.map((t) => t.id));
    const extra = EXCLUSION_CATEGORIES.filter((c) => !ids.has(c));
    expect(extra).toEqual(['nudity']);
  });
});

/**
 * What the game actually wants: gross, silly, embarrassing, and completely
 * safe. A screen that refuses these is over-blocking, and the first thing a
 * writer does with an over-blocking screen is switch it off.
 */
describe('what the game wants', () => {
  it.each([
    'Eat a spoonful of dog food on camera. Take a video.',
    'Put a spoon of cat food on a cracker and eat it. Take a video.',
    'Wear your socks on your hands for the rest of the clock. Take a photo.',
    'Eat a raw onion like an apple. Take a video.',
    'Eat cold beans from the tin with a fork. Take a video.',
  ])('accepts "%s"', (brief) => {
    const result = screen({ brief, guards: [] });
    if (!result.ok) {
      throw new Error(
        `over-blocked: ${result.violations.map((v) => `${v.category} on "${v.matched}"`).join(', ')}`,
      );
    }
    expect(result.ok).toBe(true);
  });

  /** "dog food" is a grocery; "a dog" is an animal. The boundary is the word after. */
  it('still refuses a live dog', () => {
    const result = screenTask({ brief: 'Find a dog and get it to sit.' });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.category)).toContain('animals');
    }
  });
});

/** One positive match per new rule, in the corpus wording. */
describe('the types added with the two-agent pipeline', () => {
  it.each([
    ['substances', 'Down a shot of chacha on camera.'],
    ['weapons', 'Pose with a kitchen knife like a chef.'],
    ['theft', 'Take the sign home with you.'],
    ['dangerous_ingestion', 'Eat a spoonful of soap.'],
    ['dangerous_ingestion', 'Drink a litre of water as fast as you can.'],
    ['violence', 'Slap your friend on camera.'],
    ['self_harm', 'Wax your arm on camera.'],
    ['sexual', 'Ask someone on a date on camera.'],
    ['hate', 'Do a foreign accent at your reflection.'],
    ['privacy', "Film a car's number plate."],
    ['medical', 'Swallow ten vitamins.'],
    ['gambling', 'Place a bet on camera.'],
  ] as const)('%s catches "%s"', (category, brief) => {
    const result = screenTask({ brief, guards: ['adults_only'] });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.category)).toContain(category);
    }
  });

  it('is not redeemed by any guard', () => {
    const everyGuard = [
      'adults_only',
      'no_contact',
      'outerwear_only',
      'no_obstruction',
      'consent_on_record',
      'own_wardrobe',
    ];
    for (const brief of [
      'Down a shot of chacha.',
      'Pose with a knife.',
      'Eat a spoonful of soap.',
      'Slap your friend.',
      'Place a bet.',
    ]) {
      expect(screenTask({ brief, guards: everyGuard }).ok).toBe(false);
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

    /**
     * Only the narrow `nudity` rule is redeemable. "Strip", "nude" and
     * "naked" now also trip the unredeemable `sexual` rule, so the guard
     * covers a brief that names the garment coming off, not one that says
     * strip.
     */
    it('`outerwear_only` redeems nudity', () => {
      const brief = 'Undress to your base layer and trade the outer one.';
      expect(screenTask({ brief }).ok).toBe(false);
      expect(screenTask({ brief, guards: ['outerwear_only'] }).ok).toBe(true);
    });

    it('no guard redeems "strip", which is sexual as well as nudity', () => {
      const brief = 'Strip off your outer layer and trade it.';
      expect(screenTask({ brief, guards: ['outerwear_only'] }).ok).toBe(false);
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
      'Photograph nine things on your desk.',
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

  /**
   * The game is 16+ and the Charter says so. `under 16` and `under 18` both
   * name a minor as the game draws the line, and neither is redeemable.
   */
  it('catches "under 16" as well as "under 18"', () => {
    for (const brief of [
      'Ask someone under 16 to hold your jacket.',
      'Find a stranger under-18 and swap hats.',
    ]) {
      const result = screenTask({
        brief,
        guards: ['adults_only', 'consent_on_record', 'no_contact'],
      });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.violations.map((v) => v.category)).toContain('minors');
      }
    }
  });

  /** Schools are a private place under the blocklist; the word is enough. */
  it('treats a classroom as a private place', () => {
    const result = screenTask({
      brief: 'Photograph nine things in your classroom.',
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.violations.map((v) => v.category)).toContain('privacy');
    }
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
