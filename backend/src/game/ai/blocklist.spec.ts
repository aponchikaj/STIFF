import {
  BLOCKED_TASK_TYPES,
  BLOCKED_TYPE_IDS,
  isBlockedTypeId,
  renderBlocklist,
} from './blocklist';
import { EXCLUSION_CATEGORIES } from './exclusions';

/**
 * The blocklist is the one rulebook three things read — the creator's
 * Charter, the reviewer's prompt and schema, and the regex screen. These hold
 * the shape that lets them agree.
 */
describe('the blocklist', () => {
  it('has a unique id on every entry', () => {
    const ids = BLOCKED_TASK_TYPES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(BLOCKED_TYPE_IDS).toEqual(ids);
  });

  it('gives every entry a rule and at least one example', () => {
    for (const type of BLOCKED_TASK_TYPES) {
      expect(type.rule.trim().length).toBeGreaterThan(20);
      expect(type.examples.length).toBeGreaterThan(0);
      expect(['illegal', 'dangerous', 'harmful']).toContain(type.severity);
    }
  });

  /** The three the owner named. Everything else was added on top. */
  it('names illegal substances, drugs and alcohol as one blocked type', () => {
    const substances = BLOCKED_TASK_TYPES.find((t) => t.id === 'substances');
    expect(substances).toBeDefined();
    expect(substances?.label).toContain('Illegal substances');
    expect(substances?.rule).toMatch(/drugs/i);
    expect(substances?.rule).toMatch(/drinking|alcohol/i);
    expect(substances?.severity).toBe('illegal');
  });

  /**
   * Every blocked type is also enforced by the regex screen. The screen is
   * the floor under both agents; a type only the models know about is a type
   * a clever wording gets past.
   */
  it('is enforced in full by the regex screen', () => {
    const categories: readonly string[] = EXCLUSION_CATEGORIES;
    for (const id of BLOCKED_TYPE_IDS) {
      expect(categories).toContain(id);
    }
  });

  describe('renderBlocklist', () => {
    const text = renderBlocklist();

    it('names every type by id, label and severity', () => {
      for (const type of BLOCKED_TASK_TYPES) {
        expect(text).toContain(
          `- ${type.id} — ${type.label} (${type.severity})`,
        );
      }
    });

    it('carries every example so the models see what a slip looks like', () => {
      for (const type of BLOCKED_TASK_TYPES) {
        for (const example of type.examples) {
          expect(text).toContain(`"${example}"`);
        }
      }
    });

    it('says the list is absolute', () => {
      expect(text).toMatch(/blocked absolutely/i);
    });
  });

  describe('isBlockedTypeId', () => {
    it('knows the ids', () => {
      expect(isBlockedTypeId('substances')).toBe(true);
      expect(isBlockedTypeId('gambling')).toBe(true);
    });

    it('refuses anything else', () => {
      expect(isBlockedTypeId('nudity')).toBe(false);
      expect(isBlockedTypeId('')).toBe(false);
      expect(isBlockedTypeId('SUBSTANCES')).toBe(false);
    });
  });
});
