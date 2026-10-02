import { createHash } from 'crypto';
import { BLOCKED_TASK_TYPES } from './blocklist';
import { CHARTER, CHARTER_HASH, CHARTER_PARTS } from './charter';
import { EXCLUSION_CATEGORIES, GUARDS } from './exclusions';

/**
 * The Charter is loaded into every model call, so its contents are a product
 * decision rather than copy. These tests hold the two things that would rot
 * silently: that it still names every rule the screen enforces, and that its
 * hash actually changes when it does.
 */
describe('the Charter', () => {
  it('names every excluded category the screen enforces', () => {
    for (const category of EXCLUSION_CATEGORIES) {
      expect(CHARTER.toLowerCase()).toContain(category);
    }
  });

  it('names every guard', () => {
    for (const guard of GUARDS) {
      expect(CHARTER).toContain(guard);
    }
  });

  /**
   * The mistake the spec says is most likely to happen accidentally gets its
   * own paragraph, not a mention in a list.
   */
  it('calls out adults_only as the most common mistake', () => {
    expect(CHARTER).toMatch(/adults_only.*most common mistake/s);
  });

  it('states that nothing is live', () => {
    expect(CHARTER).toMatch(/Nothing is live/i);
  });

  /**
   * Every task says how it is proved. The rule is in the Charter so the
   * creator writes it into the brief, and in the schema so the field exists.
   */
  it('carries the proof rule', () => {
    expect(CHARTER).toMatch(/`proof`/);
    for (const word of ['photo', 'video', 'either', 'Take a video.']) {
      expect(CHARTER).toContain(word);
    }
  });

  /** The register is a dare between friends, and the Charter shows one. */
  it('sets the tone with the dog-food example', () => {
    expect(CHARTER).toMatch(/dog food/i);
  });

  it('tells the creator to be strict', () => {
    expect(CHARTER).toMatch(/strict/i);
  });

  /** The blocked list is rendered from one source, so the ids are verbatim. */
  it('names every blocked task type by id', () => {
    for (const type of BLOCKED_TASK_TYPES) {
      expect(CHARTER).toContain(`- ${type.id} —`);
    }
  });

  /**
   * Clans of two play team tasks, and every task now pays. The creator has
   * to be told both, or it writes tasks one person could do with a spectator
   * and leaves the economy fields to chance.
   */
  it('explains team tasks and what a task pays', () => {
    expect(CHARTER_PARTS).toHaveLength(7);
    expect(CHARTER).toMatch(/clan/i);
    expect(CHARTER).toMatch(/BOTH/);
    expect(CHARTER).toContain('`mode: "team"`');
    for (const field of ['rewardNerve', 'rewardCoins', 'penaltyCoins']) {
      expect(CHARTER).toContain(field);
    }
  });

  it('is assembled from its parts in order', () => {
    expect(CHARTER.startsWith(CHARTER_PARTS[0])).toBe(true);
    expect(CHARTER.endsWith(CHARTER_PARTS[CHARTER_PARTS.length - 1])).toBe(
      true,
    );
  });

  describe('the hash', () => {
    it('is short enough to read in a log line', () => {
      expect(CHARTER_HASH).toMatch(/^[0-9a-f]{12}$/);
    });

    /**
     * The hash is what makes a Charter change visible in the data. If it were
     * computed from something that does not change with the text, every
     * generated task would claim rules it was never given.
     */
    it('is derived from the assembled text', () => {
      const expected = createHash('sha256')
        .update(CHARTER, 'utf8')
        .digest('hex')
        .slice(0, 12);
      expect(CHARTER_HASH).toBe(expected);
    });

    it('would move if a single character of the Charter did', () => {
      const drifted = createHash('sha256')
        .update(`${CHARTER} `, 'utf8')
        .digest('hex')
        .slice(0, 12);
      expect(drifted).not.toBe(CHARTER_HASH);
    });
  });

  /**
   * `nest build` compiles `.ts` into `dist/` and copies nothing else, so a
   * Charter kept in `.md` files would be present in development and missing in
   * production. Pinned as a non-empty constant so that failure mode cannot
   * return quietly.
   */
  it('is a compiled constant, not a file read at runtime', () => {
    expect(CHARTER.length).toBeGreaterThan(1000);
    expect(CHARTER_PARTS.every((part) => part.trim().length > 0)).toBe(true);
  });
});
