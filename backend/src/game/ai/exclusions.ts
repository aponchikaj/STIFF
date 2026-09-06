/**
 * The exclusion list, as code.
 *
 * Spec §11 part II. This is the list that removes almost everything Nerve did,
 * and it is the single most important file in the AI half of the game: a model
 * generating tasks will happily write a good one that is also illegal, and the
 * only thing between that and a player's phone is this screen.
 *
 * **It runs after generation, never instead of it.** The Charter tells the model
 * what it may not write; this checks whether it listened. Both, always — a
 * prompt is a request and a screen is a decision.
 *
 * Pure and dependency-free so it can be tested exhaustively and run in CI over
 * the adversarial corpus. No Nest, no I/O, no model call.
 *
 * **Fails closed.** An unrecognised shape is a violation, not a pass. A task
 * this rejects wrongly costs one regeneration; a task it passes wrongly costs
 * somebody an injury or an arrest.
 */

export const EXCLUSION_CATEGORIES = [
  'trespass',
  'traffic',
  'heights',
  'water',
  'fire',
  'substances',
  'confrontation',
  'nudity',
  'touching',
  'minors',
  'deception',
  'disruption',
  'animals',
  'stunts',
  'spending',
] as const;

export type ExclusionCategory = (typeof EXCLUSION_CATEGORIES)[number];

export const GUARDS = [
  'adults_only',
  'no_contact',
  'outerwear_only',
  'no_obstruction',
  'consent_on_record',
  'own_wardrobe',
] as const;

export type Guard = (typeof GUARDS)[number];

export interface ScreenedTask {
  brief: string;
  tier?: number;
  guards?: string[];
  criteria?: { assert?: string }[];
}

export interface Violation {
  category: ExclusionCategory;
  /** The phrase that tripped it, so a reviewer can see the reason. */
  matched: string;
  /** What the writer has to do about it. */
  remedy: string;
}

export type ScreenResult =
  { ok: true } | { ok: false; violations: Violation[] };

interface Rule {
  category: ExclusionCategory;
  patterns: RegExp[];
  remedy: string;
  /**
   * Guards that make this category acceptable.
   *
   * Only three categories are redeemable this way, and each maps to a real
   * task in `season-zero-tasks.md`: handing a stranger a jacket is fine with
   * `no_contact`, swapping clothes is fine with `outerwear_only`, and filming
   * strangers is fine with `adults_only` and `consent_on_record`. Everything
   * else is a flat no — there is no guard that makes trespass legal.
   */
  redeemedBy?: Guard[];
}

/**
 * Word-boundary matching on purpose. Substring matching turns "class" into
 * trespass and "waterproof" into water, and a screen that cries wolf gets
 * switched off.
 */
const RULES: Rule[] = [
  {
    category: 'trespass',
    patterns: [
      /\b(trespass|break in|breaking in|sneak into|climb the fence|private property|no.entry|staff only|restricted area)\b/i,
    ],
    remedy: 'Rewrite for a place the player may lawfully be.',
  },
  {
    category: 'traffic',
    patterns: [
      /\b(road|roadway|traffic|motorway|highway|crosswalk|zebra crossing|level crossing|railway|train track|metro track|oncoming)\b/i,
    ],
    remedy: 'Move the task away from vehicles and tracks.',
  },
  {
    category: 'heights',
    patterns: [
      /\b(rooftop|roof|balcony|ledge|scaffold|climb (?:up|onto|the)|balcony rail|fire escape|parapet)\b/i,
    ],
    remedy: 'Keep both feet at ground level.',
  },
  {
    category: 'water',
    patterns: [
      /\b(river|lake|sea|swim|dive|canal|reservoir|fountain(?:.{0,20}\b(?:in|into|enter))?|pier edge)\b/i,
    ],
    remedy: 'Remove the water. Nobody is filmed near a drop into water.',
  },
  {
    category: 'fire',
    patterns: [
      /\b(fire|flame|burn|lighter|match(?:es)?|firework|smoke bomb|candle|ignite)\b/i,
    ],
    remedy: 'Remove the ignition source.',
  },
  {
    category: 'substances',
    patterns: [
      /\b(alcohol|drunk|beer|wine|vodka|shot of|drug|weed|cannabis|smoke a|cigarette|vape|pill)\b/i,
    ],
    remedy: 'Remove the substance entirely.',
  },
  {
    category: 'confrontation',
    patterns: [
      /\b(argue|argument|confront|provoke|insult|heckle|shout at|yell at|prank|humiliate|embarrass (?:a|the) stranger|start a fight)\b/i,
    ],
    remedy: 'The stranger must end the interaction no worse off.',
  },
  {
    category: 'nudity',
    patterns: [
      /\b(naked|nude|nudity|topless|strip|underwear|undress|bare chest)\b/i,
    ],
    remedy: 'Cap what may be removed; name the permitted items in the brief.',
    redeemedBy: ['outerwear_only'],
  },
  {
    category: 'touching',
    patterns: [
      /\b(touch|hug|kiss|grab|hold (?:their|his|her) hand|put .{0,20}on them|dress them|physical contact)\b/i,
    ],
    remedy:
      'Add `no_contact` and say in the brief: hand it over, do not put it on them.',
    redeemedBy: ['no_contact'],
  },
  {
    category: 'minors',
    patterns: [
      // `schoolchild(ren)?` is spelled out because `\bchildren\b` cannot match
      // inside the compound — there is no word boundary between `l` and `c`.
      /\b(child(?:ren)?|kid|kids|minors?|teenager|schoolchild(?:ren)?|school.?kids?|under.?18|pupils?|toddler)\b/i,
    ],
    // Deliberately NOT redeemable. `adults_only` is the guard you add to a
    // task about "strangers" to constrain who counts; it cannot redeem a brief
    // that names children outright, because the words contradict the guard.
    // The structural requirement is enforced separately by `requiresAdultsOnly`.
    remedy: 'No identifiable minors, under any guard. Rewrite for adults.',
  },
  {
    category: 'deception',
    patterns: [
      /\b(lie to|pretend to be|impersonate|trick (?:a|the|them)|deceive|fake (?:an|a) (?:injury|emergency|identity)|pose as)\b/i,
    ],
    remedy: 'The stranger must know what is happening.',
  },
  {
    category: 'disruption',
    patterns: [
      /\b(block the|blocking the|doorway|obstruct|interrupt a|disrupt|inside a shop|queue jump|cause a scene)\b/i,
    ],
    remedy: 'Add `no_obstruction` and tell the player to stand out of the way.',
    redeemedBy: ['no_obstruction'],
  },
  {
    category: 'animals',
    patterns: [/\b(dog|cat|animal|pigeon|stray|pet|bird)\b/i],
    remedy: 'Remove the animal.',
  },
  {
    category: 'stunts',
    patterns: [
      /\b(jump (?:from|off|over)|backflip|parkour|somersault|sprint across|stunt|handstand|balance on)\b/i,
    ],
    remedy: 'Remove the physical risk.',
  },
  {
    category: 'spending',
    patterns: [
      /\b(buy|purchase|pay for|receipt|spend|cost you|tip the|order (?:a|an) (?:coffee|drink|meal))\b/i,
    ],
    remedy:
      'The qualifier must be completable by someone who has never bought anything.',
  },
];

/**
 * Screens one task.
 *
 * Reads the brief *and* every criterion: a brief can stay clean while a
 * criterion quietly asks for the thing the brief avoided saying.
 */
export function screenTask(task: ScreenedTask): ScreenResult {
  const guards = new Set(task.guards ?? []);
  const haystack = [
    task.brief ?? '',
    ...(task.criteria ?? []).map((c) => c.assert ?? ''),
  ].join('\n');

  if (!haystack.trim()) {
    return {
      ok: false,
      violations: [
        {
          category: 'deception',
          matched: '(empty)',
          remedy: 'A task with no brief cannot be screened. Fail closed.',
        },
      ],
    };
  }

  const violations: Violation[] = [];
  for (const rule of RULES) {
    const matched = firstMatch(rule.patterns, haystack);
    if (!matched) continue;
    // A guard redeems the category only where the spec says it can.
    if (rule.redeemedBy?.some((g) => guards.has(g))) continue;
    violations.push({
      category: rule.category,
      matched,
      remedy: rule.remedy,
    });
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

/**
 * Every stranger-facing task carries `adults_only`.
 *
 * Spec: *"no filming identifiable minors is the guard most likely to be
 * violated accidentally, and it is the one the safety classifier should weight
 * hardest."* So it is checked structurally rather than left to the wording.
 */
export function requiresAdultsOnly(task: ScreenedTask): boolean {
  const haystack = [
    task.brief ?? '',
    ...(task.criteria ?? []).map((c) => c.assert ?? ''),
  ].join('\n');
  return /\b(stranger|strangers|someone else|another person|passer.?by|people|person)\b/i.test(
    haystack,
  );
}

/** The full screen: exclusions, plus the structural guard requirements. */
export function screen(task: ScreenedTask): ScreenResult {
  const result = screenTask(task);
  const violations = result.ok ? [] : result.violations;

  if (
    requiresAdultsOnly(task) &&
    !(task.guards ?? []).includes('adults_only')
  ) {
    violations.push({
      category: 'minors',
      matched: 'stranger-facing task without adults_only',
      remedy:
        'Every task involving another person carries `adults_only`, stated in the brief.',
    });
  }

  return violations.length === 0 ? { ok: true } : { ok: false, violations };
}

function firstMatch(patterns: RegExp[], text: string): string | null {
  for (const pattern of patterns) {
    const found = pattern.exec(text);
    if (found) return found[0];
  }
  return null;
}

export function isGuard(value: string): value is Guard {
  return (GUARDS as readonly string[]).includes(value);
}
