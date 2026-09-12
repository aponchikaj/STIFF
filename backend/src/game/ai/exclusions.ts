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
  'weapons',
  'theft',
  'dangerous_ingestion',
  'violence',
  'self_harm',
  'sexual',
  'hate',
  'privacy',
  'medical',
  'gambling',
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
      /\b(alcohol|alcoholic|drunk|beer|wine|vodka|whisky|whiskey|tequila|chacha|cocktail|shots?|shot of|drugs?|weed|cannabis|joint|hash|cocaine|mdma|ecstasy|lsd|mushrooms|smoke a|smoking|cigarettes?|tobacco|vapes?|vaping|hookah|shisha|bar crawl|liquor|(?:a|the) bar)\b/i,
    ],
    remedy:
      'Remove the substance entirely — no drink, no drug, no smoke, no bar.',
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
      /\b(child(?:ren)?|kid|kids|minors?|teenager|schoolchild(?:ren)?|school.?kids?|under.?1[68]|pupils?|toddler)\b/i,
    ],
    // Deliberately NOT redeemable. `adults_only` is the guard you add to a
    // task about "strangers" to constrain who counts; it cannot redeem a brief
    // that names children outright, because the words contradict the guard.
    // The structural requirement is enforced separately by `requiresAdultsOnly`.
    remedy:
      'No identifiable minors under 16, under any guard. Strangers approached must be adults.',
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
    // "dog food" and "cat food" are groceries, not animals — a player eating
    // a spoon of kibble on camera is exactly the kind of dare the game wants.
    patterns: [
      /\b(dogs?|cats?|puppy|kitten)\b(?!\s*(?:food|treats?|biscuits?|kibble))/i,
      /\b(animals?|pigeons?|strays?|pets?|birds?|horse|cow|goat|chicken(?!\s*(?:nuggets?|wings?|breast|soup|stock))|squirrel|feed the)\b/i,
    ],
    remedy: 'Remove the live animal. Pet food eaten by the player is fine.',
  },
  {
    category: 'stunts',
    patterns: [
      /\b(jump (?:from|off|over)|backflip|parkour|somersault|sprint across|stunt|handstand|balance on)\b/i,
    ],
    remedy: 'Remove the physical risk.',
  },
  {
    category: 'weapons',
    patterns: [
      /\b(knife|knives|blade|gun|pistol|rifle|firearm|taser|pepper spray|replica|airsoft|bb gun|crossbow|bat as|machete|sword|brass knuckles|weapon)\b/i,
    ],
    remedy: 'Remove the weapon or anything that looks like one.',
  },
  {
    category: 'theft',
    patterns: [
      /\b(steal|shoplift|take (?:a|the) (?:sign|cone|menu|flag)|without paying|graffiti|spray.?paint|tag (?:a|the) wall|sticker on|vandali[sz]e|smash|break (?:a|the) window|let the air out|scratch (?:a|the) car|keyed?)\b/i,
    ],
    remedy: 'Nothing is taken, marked or damaged, including public property.',
  },
  {
    category: 'dangerous_ingestion',
    patterns: [
      /\b(soap|detergent|bleach|glue|paint|chalk|wax|candle wax|tide pod|raw (?:chicken|meat|egg|fish|pork)|expired|mouldy|moldy|rotten|inedible|non.?food|cinnamon challenge|ghost pepper|carolina reaper|hot sauce challenge|chug|down (?:a|the) (?:bottle|litre|liter)|as fast as you can|in one go|in one gulp|swallow (?:it )?whole|without chewing|insects?|bugs?|worms?|cockroach|toothpaste|shampoo|perfume|hand sanitizer|sanitiser|lighter fluid)\b/i,
    ],
    remedy:
      'Anything eaten must be food-safe in the amount asked, at a normal pace. Gross is fine; harmful is not.',
  },
  {
    category: 'violence',
    patterns: [
      /\b(slap|punch|kick|hit (?:a|the|them|someone)|push (?:a|the|them|someone)|shove|tackle|wrestle|fight|threaten|chase (?:a|the|them|someone)|corner (?:a|the|them|someone)|headbutt|choke)\b/i,
    ],
    remedy: 'Nobody is touched, threatened, chased or made to feel unsafe.',
  },
  {
    category: 'self_harm',
    patterns: [
      /\b(cut yourself|burn yourself|hurt yourself|wax (?:your|off)|hold your breath|until it hurts|electric shock|shock yourself|slap yourself|punch yourself|bruise|bleed|pierce|tattoo|shave your (?:head|eyebrows?)|eyebrow)\b/i,
    ],
    remedy:
      'Nothing that causes the player pain or lasting change, even as a joke.',
  },
  {
    category: 'sexual',
    patterns: [
      /\b(sexy|sexual|seduce|flirt|pick.?up line|ask (?:a|the|them|someone|(?:a |the )?strangers?|(?:a |the )?passer.?by|anyone) (?:out|on a date)|twerk|lap dance|kiss|lingerie|bikini|thong|crotch|butt|boobs?|breasts?|nipple|strip(?:tease)?|pole dance|onlyfans|nude|naked)\b/i,
    ],
    remedy: 'Nothing sexual, suggestive, or undressed.',
  },
  {
    category: 'hate',
    patterns: [
      /\b(accent|racist|racial|ethnic|religion|religious|church|mosque|synagogue|prayer|political|politician|protest|slogan|flag|nationalit(?:y|ies)|immigrants?|refugees?|gay|trans|fat|disabled|homeless|beggar|make fun of|mock)\b/i,
    ],
    remedy:
      'Nothing that targets or references a group, a faith, a body, or a side.',
  },
  {
    category: 'privacy',
    patterns: [
      /\b(licen[cs]e plate|number plate|car plate|address|phone number|their name|full name|id card|passport|documents?|toilet|bathroom|changing room|locker room|hospital|clinic|school|classroom|inside (?:a|their|someone's) (?:home|house|flat|apartment)|their screen|over (?:their|his|her) shoulder)\b/i,
    ],
    remedy: 'No private places, no personal details of anyone.',
  },
  {
    category: 'medical',
    patterns: [
      /\b(pills?|tablets?|vitamins?|supplements?|medic(?:ine|ation)|injection|syringe|needle|blood|vomit|puke|throw up|urine|pee|spit (?:on|at)|bandage|first aid|cpr)\b/i,
    ],
    remedy: 'Nothing medical, no medication, no bodily fluids.',
  },
  {
    category: 'gambling',
    patterns: [
      /\b(bet|betting|wager|casino|slot machine|slots|poker|roulette|lottery|scratch card|bookmaker|bookies)\b/i,
    ],
    remedy: 'No bets, no casinos, no games for money.',
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
