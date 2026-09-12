import { BLOCKED_TYPE_IDS } from '../ai/blocklist';
import {
  ACTIONS_FOR_TARGET,
  actionAllowed,
  autoHideThreshold,
  DEFAULT_AUTO_HIDE_THRESHOLD,
  DEFAULT_REPORT_DAILY_CAP,
  MAX_REPORT_TAGS,
  normaliseTags,
  priorityFor,
  reasonAllowed,
  reasonFor,
  reasonsFor,
  REASONS_FOR_TARGET,
  reportDailyCap,
  REPORT_ACTIONS,
  REPORT_REASONS,
  REPORT_TAGS,
  REPORT_TARGET_TYPES,
} from './report-rules';

/**
 * The catalogue is rendered to the client and enforced by the service, so
 * the two things that must never drift are pinned here: every reason a
 * target lists exists, and every id is spelled once.
 */

const env = (values: Record<string, string>) => ({
  get: <T = string>(key: string) => values[key] as T | undefined,
});

describe('report rules', () => {
  it('every reason id is unique', () => {
    const ids = REPORT_REASONS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every target lists only reasons that exist, ending with "other"', () => {
    for (const type of REPORT_TARGET_TYPES) {
      const listed = REASONS_FOR_TARGET[type];
      expect(listed.length).toBeGreaterThan(1);
      for (const id of listed) expect(reasonFor(id)).not.toBeNull();
      expect(listed[listed.length - 1]).toBe('other');
      expect(() => reasonsFor(type)).not.toThrow();
    }
  });

  it('every reason is reachable from at least one target', () => {
    const reachable = new Set(Object.values(REASONS_FOR_TARGET).flat());
    for (const r of REPORT_REASONS) expect(reachable.has(r.id)).toBe(true);
  });

  it('every target allows "none" and only actions that exist', () => {
    for (const type of REPORT_TARGET_TYPES) {
      expect(ACTIONS_FOR_TARGET[type]).toContain('none');
      for (const a of ACTIONS_FOR_TARGET[type]) {
        expect(REPORT_ACTIONS).toContain(a);
      }
    }
    expect(actionAllowed('task', 'retire_task')).toBe(true);
    expect(actionAllowed('task', 'flag_cheater')).toBe(false);
    expect(actionAllowed('app', 'remove_content')).toBe(false);
  });

  describe('who may use which reason', () => {
    it('an appeal is only on one’s own hand-in', () => {
      expect(reasonAllowed('attempt', 'wrong_verdict', true)).toBe(true);
      expect(reasonAllowed('attempt', 'wrong_verdict', false)).toBe(false);
    });

    it('cheating is only about somebody else', () => {
      expect(reasonAllowed('attempt', 'cheating', false)).toBe(true);
      expect(reasonAllowed('attempt', 'cheating', true)).toBe(false);
    });

    it('a task can be reported as dangerous by anyone', () => {
      expect(reasonAllowed('task', 'dangerous', false)).toBe(true);
      expect(reasonAllowed('task', 'dangerous', true)).toBe(true);
    });

    it('a reason the target does not list is refused even if it exists', () => {
      expect(reasonFor('cheating')).not.toBeNull();
      expect(reasonAllowed('shop_item', 'cheating', false)).toBe(false);
    });

    it('a purchase can only be reported by its owner', () => {
      for (const id of REASONS_FOR_TARGET.purchase) {
        if (id === 'other') continue;
        expect(reasonAllowed('purchase', id, false)).toBe(false);
        expect(reasonAllowed('purchase', id, true)).toBe(true);
      }
    });
  });

  describe('priority', () => {
    it('is critical for anything where a person may be at risk', () => {
      for (const id of ['self_harm', 'minor_in_frame', 'underage', 'illegal']) {
        expect(priorityFor(id)).toBe(3);
      }
    });

    it('is low for "other" and normal for the unknown', () => {
      expect(priorityFor('other')).toBe(0);
      expect(priorityFor('nonsense')).toBe(1);
    });
  });

  describe('tags', () => {
    it('are the blocklist ids, exactly', () => {
      expect(REPORT_TAGS.map((t) => t.id)).toEqual(BLOCKED_TYPE_IDS);
    });

    it('keeps known ids once each, in order, at most the cap', () => {
      expect(normaliseTags(['Weapons', 'weapons', 'nope', 'fire'])).toEqual([
        'weapons',
        'fire',
      ]);
      expect(normaliseTags(undefined)).toEqual([]);
      expect(normaliseTags(BLOCKED_TYPE_IDS)).toHaveLength(MAX_REPORT_TAGS);
    });
  });

  describe('thresholds from the environment', () => {
    it('defaults when unset or unreadable', () => {
      expect(autoHideThreshold()).toBe(DEFAULT_AUTO_HIDE_THRESHOLD);
      expect(autoHideThreshold(env({ GAME_REPORT_AUTO_HIDE: 'x' }))).toBe(
        DEFAULT_AUTO_HIDE_THRESHOLD,
      );
      expect(reportDailyCap(env({ GAME_REPORT_DAILY_CAP: '0' }))).toBe(
        DEFAULT_REPORT_DAILY_CAP,
      );
    });

    it('reads a value, and zero disables auto-hide', () => {
      expect(autoHideThreshold(env({ GAME_REPORT_AUTO_HIDE: '3' }))).toBe(3);
      expect(autoHideThreshold(env({ GAME_REPORT_AUTO_HIDE: '0' }))).toBe(0);
      expect(reportDailyCap(env({ GAME_REPORT_DAILY_CAP: '5' }))).toBe(5);
    });
  });
});
