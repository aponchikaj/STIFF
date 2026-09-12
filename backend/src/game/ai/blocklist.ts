/**
 * The blocked task types — the one list both agents and the screen read.
 *
 * The creator is told never to write these. The reviewer is told to reject
 * anything that is one of these, however it is worded. The regex screen in
 * `exclusions.ts` is the floor under both: a deterministic check that needs
 * no model and cannot be talked out of it.
 *
 * One list, rendered three ways, so the three can never disagree about what
 * is banned. Adding a type here is the whole job: the Charter text is built
 * from it, the reviewer's schema enumerates it, and `charter.spec.ts` fails
 * if the screen does not enforce it.
 *
 * `illegal` types are the ones the owner named plus what the law names; the
 * rest are what gets someone hurt, harassed, or removed from the game. The
 * split only changes the reviewer's severity — both are rejected outright.
 */

export interface BlockedTaskType {
  id: string;
  label: string;
  /** The rule, in a sentence the model can apply. */
  rule: string;
  /** What it looks like when it slips in. Shown to both agents. */
  examples: string[];
  severity: 'illegal' | 'dangerous' | 'harmful';
}

export const BLOCKED_TASK_TYPES: readonly BlockedTaskType[] = [
  {
    id: 'substances',
    label: 'Illegal substances, drugs, alcohol, tobacco, vapes',
    rule: 'No task involves, mentions, mimics or rewards drinking, drugs of any kind, smoking or vaping — not as the dare, not as a prop, not as a setting like a bar.',
    examples: [
      'down a shot on camera',
      'ask a stranger for a cigarette',
      'roll something that looks like a joint',
    ],
    severity: 'illegal',
  },
  {
    id: 'weapons',
    label: 'Weapons',
    rule: 'No knives, guns, replicas, fireworks, tasers, bats used as weapons, or anything carried to look like one.',
    examples: ['pose with a knife', 'point a toy gun at someone'],
    severity: 'illegal',
  },
  {
    id: 'theft',
    label: 'Theft, vandalism, property damage',
    rule: 'Nothing is taken, moved without permission, marked, stickered, broken or dirtied — including your own things in a public place.',
    examples: [
      'take a sign and film it',
      'write on a wall',
      'let air out of a tyre',
    ],
    severity: 'illegal',
  },
  {
    id: 'trespass',
    label: 'Trespass',
    rule: 'The player is somewhere they may lawfully be, the whole time.',
    examples: ['sneak into a building site', 'go through a staff-only door'],
    severity: 'illegal',
  },
  {
    id: 'traffic',
    label: 'Roads, tracks, vehicles',
    rule: 'No roads, crossings, tracks, platforms edges, or moving vehicles in the task.',
    examples: ['stand in the road', 'sit on a car bonnet at the lights'],
    severity: 'dangerous',
  },
  {
    id: 'heights',
    label: 'Heights',
    rule: 'Both feet at ground level, always. No roofs, balconies, ledges, climbing.',
    examples: ['film from a rooftop', 'sit on a balcony rail'],
    severity: 'dangerous',
  },
  {
    id: 'water',
    label: 'Water',
    rule: 'No rivers, lakes, sea, canals, fountains, pools — not in, not on the edge of.',
    examples: ['jump in the fountain', 'wade into the river'],
    severity: 'dangerous',
  },
  {
    id: 'fire',
    label: 'Fire and heat',
    rule: 'No flames, lighters, matches, candles, fireworks, hot surfaces.',
    examples: ['light something on camera', 'hold a candle under your chin'],
    severity: 'dangerous',
  },
  {
    id: 'dangerous_ingestion',
    label: 'Dangerous eating or drinking',
    rule: 'Anything eaten or drunk is food-safe for a human in the amount asked: nothing inedible, toxic, raw, expired, an allergen challenge, a choking risk, a chugging or speed challenge, or a quantity that could hurt. Gross is fine; harmful is not.',
    examples: [
      'eat a spoon of soap',
      'swallow a raw egg in one go',
      'the cinnamon challenge',
      'drink a litre of water as fast as you can',
    ],
    severity: 'dangerous',
  },
  {
    id: 'stunts',
    label: 'Stunts and physical risk',
    rule: 'No jumping from or over things, climbing, running at speed, balancing, flips, lifting, or anything that can end in a fall.',
    examples: ['backflip off a bench', 'parkour across the square'],
    severity: 'dangerous',
  },
  {
    id: 'violence',
    label: 'Violence, threats, fighting',
    rule: 'Nobody is hit, pushed, threatened, chased, cornered or made to feel unsafe. No play-fighting with strangers.',
    examples: ['slap a friend on camera', 'chase a stranger'],
    severity: 'harmful',
  },
  {
    id: 'self_harm',
    label: 'Self-harm and pain',
    rule: 'Nothing that cuts, burns, bruises, shocks, holds breath, or causes pain to the player, even as a joke.',
    examples: ['wax your arm on camera', 'hold ice until it hurts'],
    severity: 'dangerous',
  },
  {
    id: 'sexual',
    label: 'Sexual content and nudity',
    rule: 'Nothing sexual, suggestive, or undressed. Outerwear may come off where the brief names the exact items; nothing more.',
    examples: [
      'take your shirt off in the square',
      'ask a stranger on a date on camera',
    ],
    severity: 'harmful',
  },
  {
    id: 'touching',
    label: 'Touching people',
    rule: 'No physical contact with anyone. Hand things over; never put anything on a person.',
    examples: ['hug five strangers', 'put your hat on a passer-by'],
    severity: 'harmful',
  },
  {
    id: 'minors',
    label: 'Minors',
    rule: 'No identifiable person under 16 in frame; anyone the player approaches or interacts with is an adult (18+).',
    examples: ['ask a kid to rate your outfit', 'film in a playground'],
    severity: 'illegal',
  },
  {
    id: 'confrontation',
    label: 'Harassment, pranks on strangers, humiliation',
    rule: 'A stranger ends the interaction no worse off: no pranks, no tricking, no insults, no shouting, no filming someone who did not agree to it.',
    examples: ['prank a shop assistant', 'heckle a street musician'],
    severity: 'harmful',
  },
  {
    id: 'hate',
    label: 'Hate, discrimination, politics, religion',
    rule: 'Nothing that targets, mocks or references a group, a faith, a nationality, a body, or a political side. No slogans, no symbols, no flags used as a joke.',
    examples: [
      'do an accent at a stranger',
      'wear a political slogan to a church',
    ],
    severity: 'harmful',
  },
  {
    id: 'deception',
    label: 'Deception and impersonation',
    rule: 'The other person always knows what is happening. No pretending to be staff, police, a doctor, injured, lost, or in trouble.',
    examples: ['pretend to faint', 'pose as a security guard'],
    severity: 'harmful',
  },
  {
    id: 'privacy',
    label: 'Privacy and doxxing',
    rule: 'No filming inside private homes, toilets, changing rooms, hospitals or schools; no reading out, photographing or sharing anyone’s name, plate, address, phone, screen or documents.',
    examples: ['film a stranger’s car plate', 'read a name off a delivery bag'],
    severity: 'illegal',
  },
  {
    id: 'disruption',
    label: 'Disruption of businesses, queues, doorways',
    rule: 'Nothing blocks a door, a queue, a counter, a stage, a road of people, or a business at work.',
    examples: [
      'lie down in a shop entrance',
      'stand still in a metro turnstile',
    ],
    severity: 'harmful',
  },
  {
    id: 'animals',
    label: 'Live animals',
    rule: 'No live animal is approached, fed, handled, chased, filmed as the subject or used as a prop. Pet food eaten by the player is not an animal.',
    examples: ['pet a stray dog', 'feed the pigeons from your mouth'],
    severity: 'harmful',
  },
  {
    id: 'medical',
    label: 'Medical, medication, bodily fluids',
    rule: 'No pills, supplements, injections, medical devices, blood, vomit, urine, spit on people, or anything that mimics a medical act.',
    examples: ['swallow ten vitamins', 'give a stranger a fake injection'],
    severity: 'dangerous',
  },
  {
    id: 'gambling',
    label: 'Gambling and money games',
    rule: 'No bets, casinos, slot machines, betting shops, or games for money.',
    examples: ['place a bet on camera', 'film inside a slot hall'],
    severity: 'illegal',
  },
  {
    id: 'spending',
    label: 'Required spending',
    rule: 'A task is completable by someone who buys nothing. A household item they probably already have is fine; a purchase is not.',
    examples: ['buy a coffee for a stranger', 'order a meal and film it'],
    severity: 'harmful',
  },
] as const;

export const BLOCKED_TYPE_IDS = BLOCKED_TASK_TYPES.map((t) => t.id);

export function isBlockedTypeId(value: string): boolean {
  return BLOCKED_TYPE_IDS.includes(value);
}

/**
 * The list as the models read it. Same text for the creator and the
 * reviewer, so neither can claim a rule the other was not given.
 */
export function renderBlocklist(): string {
  const lines: string[] = [
    'These task types are blocked absolutely. There is no wording, framing,',
    'guard, disclaimer or artistic justification that admits them. If a task',
    'is one of these in substance, it is one of these.',
    '',
  ];
  for (const type of BLOCKED_TASK_TYPES) {
    lines.push(
      `- ${type.id} — ${type.label} (${type.severity}). ${type.rule}`,
      `  Looks like: ${type.examples.map((e) => `"${e}"`).join(', ')}.`,
    );
  }
  return lines.join('\n');
}
