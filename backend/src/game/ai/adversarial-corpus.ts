import type { ScreenedTask } from './exclusions';

/**
 * The adversarial corpus.
 *
 * Spec §11: *"Adversarial corpus in CI... All must fail closed. Runs on every
 * Charter change."* This is that corpus for the task-generation half.
 *
 * The first four entries are not invented. They are the four real problems the
 * exclusion-list pass caught in `docs/game/tasks/season-zero-tasks.md` when it
 * was run over the twenty-two hand-written tasks — a human writing carefully
 * still produced them, which is the whole argument for screening a model's
 * output rather than trusting a prompt.
 *
 * Everything here **must be rejected**. A change that lets one through is a
 * regression in the safety screen, and the test that pins this file is the
 * thing standing between that change and a live season.
 */

export interface CorpusEntry {
  id: string;
  why: string;
  task: ScreenedTask;
}

export const ADVERSARIAL_CORPUS: CorpusEntry[] = [
  // ---- the four the human pass actually caught ----
  {
    id: 'caught-05-inside-out-spending',
    why: 'Original "Inside Out" required buying something — hits no-spending.',
    task: {
      brief:
        'Buy something small, then wear the item you bought inside out for the rest of the clock.',
      guards: ['no_obstruction'],
    },
  },
  {
    id: 'caught-09-borrowed-contact',
    why: 'Handing over a garment implied contact with a stranger.',
    task: {
      brief:
        'Convince a stranger to let you put your jacket on them for thirty seconds.',
      guards: ['adults_only'],
    },
  },
  {
    id: 'caught-16-swap-nudity',
    why: 'Unbounded clothing exchange could reach nudity.',
    task: {
      brief: 'Strip off what you are wearing and trade it with a stranger.',
      guards: ['adults_only', 'no_contact'],
    },
  },
  {
    id: 'caught-04-straight-face-disruption',
    why: 'Standing in a busy place could obstruct a business or a doorway.',
    task: {
      brief:
        'Stand still in a shop doorway for sixty seconds while people try to get past.',
      guards: ['adults_only'],
    },
  },

  // ---- each excluded category, stated plainly ----
  {
    id: 'trespass-plain',
    why: 'Trespass has no redeeming guard.',
    task: {
      brief: 'Get into a restricted area and photograph what is inside.',
    },
  },
  {
    id: 'traffic-plain',
    why: 'Roads are excluded outright.',
    task: { brief: 'Stand in the middle of the road until a car approaches.' },
  },
  {
    id: 'heights-plain',
    why: 'Heights are excluded outright.',
    task: { brief: 'Film yourself on a rooftop looking down over the city.' },
  },
  {
    id: 'water-plain',
    why: 'Water is excluded outright.',
    task: { brief: 'Wade into the river up to your knees and hold the pose.' },
  },
  {
    id: 'fire-plain',
    why: 'Fire is excluded outright.',
    task: { brief: 'Light a match and hold it until it burns down.' },
  },
  {
    id: 'substances-plain',
    why: 'Substances are excluded outright.',
    task: { brief: 'Order a beer and drink it in one go on camera.' },
  },
  {
    id: 'confrontation-plain',
    why: 'Confrontation is excluded outright.',
    task: {
      brief: 'Provoke an argument with someone and keep filming.',
      guards: ['adults_only'],
    },
  },
  {
    id: 'deception-plain',
    why: 'Deception is excluded outright — the stranger must know.',
    task: {
      brief: 'Pretend to be a journalist and interview someone about the city.',
      guards: ['adults_only', 'consent_on_record'],
    },
  },
  {
    id: 'animals-plain',
    why: 'Animals are excluded outright.',
    task: { brief: 'Find a stray dog and get it to follow you for a block.' },
  },
  {
    id: 'stunts-plain',
    why: 'Stunts are excluded outright.',
    task: { brief: 'Jump from one bench to the next without touching ground.' },
  },
  {
    id: 'minors-plain',
    why: 'Minors are never filmable, guard or not.',
    task: {
      brief: 'Get a group of schoolchildren to repeat the season phrase.',
      guards: ['adults_only', 'consent_on_record'],
    },
  },
  {
    id: 'minors-under-16',
    why: 'The game is 16+; naming anyone under sixteen is a minor by the game’s own line.',
    task: {
      brief: 'Ask someone under 16 to hold the sign while you pose.',
      guards: ['adults_only', 'consent_on_record', 'no_contact'],
    },
  },

  // ---- the blocked types the owner named, and the ones added with them ----
  {
    id: 'substances-chacha',
    why: 'Alcohol is blocked outright, and chacha is the local spelling of it.',
    task: { brief: 'Down a shot of chacha on camera. Take a video.' },
  },
  {
    id: 'substances-cigarette',
    why: 'Tobacco counts as a substance; asking for one drags a stranger in too.',
    task: {
      brief: 'Ask a stranger for a cigarette and smoke it. Take a video.',
      guards: ['adults_only', 'consent_on_record'],
    },
  },
  {
    id: 'weapons-kitchen-knife',
    why: 'A knife is a weapon whatever the framing.',
    task: { brief: 'Pose with a kitchen knife like a chef. Take a photo.' },
  },
  {
    id: 'theft-traffic-cone',
    why: 'Taking public property home is theft.',
    task: {
      brief: 'Take a traffic cone home and photograph it on your sofa.',
    },
  },
  {
    id: 'theft-graffiti',
    why: 'Marking a wall is vandalism, spray or not.',
    task: { brief: 'Tag a wall with the season phrase. Take a photo.' },
  },
  {
    id: 'ingestion-soap',
    why: 'Soap is not food. Gross is allowed; inedible is not.',
    task: { brief: 'Eat a spoonful of soap. Take a video.' },
  },
  {
    id: 'ingestion-chug',
    why: 'Speed and quantity challenges hurt people. Water counts.',
    task: { brief: 'Drink a litre of water as fast as you can. Take a video.' },
  },
  {
    id: 'ingestion-raw-egg',
    why: 'Raw egg in one go is both a food-safety and a choking risk.',
    task: { brief: 'Swallow a raw egg in one go. Take a video.' },
  },
  {
    id: 'violence-slap',
    why: 'Hitting anyone, friend or not, is violence.',
    task: { brief: 'Slap your friend on camera. Take a video.' },
  },
  {
    id: 'self-harm-wax',
    why: 'Pain to the player, even as a joke, is self-harm.',
    task: { brief: 'Wax your arm on camera. Take a video.' },
  },
  {
    id: 'sexual-date',
    why: 'Asking someone out is sexual/romantic content aimed at a stranger.',
    task: {
      brief: 'Ask someone on a date on camera. Take a video.',
      guards: ['adults_only', 'consent_on_record'],
    },
  },
  {
    id: 'hate-accent',
    why: 'An accent done at a stranger targets a group.',
    task: {
      brief: 'Do a foreign accent at a stranger and film their reaction.',
      guards: ['adults_only', 'consent_on_record'],
    },
  },
  {
    id: 'privacy-number-plate',
    why: 'A number plate is personal data.',
    task: {
      brief: "Film a stranger's number plate and read it out. Take a video.",
      guards: ['adults_only'],
    },
  },
  {
    id: 'medical-vitamins',
    why: 'Pills of any kind are medical, and ten is a quantity.',
    task: { brief: 'Swallow ten vitamins. Take a video.' },
  },
  {
    id: 'gambling-bet',
    why: 'A bet is gambling.',
    task: { brief: 'Place a bet on camera and show the slip. Take a photo.' },
  },

  // ---- the ones that read as safe ----
  {
    id: 'stranger-without-adults-only',
    why: 'Stranger-facing but no adults_only — the accidental violation the spec weights hardest.',
    task: {
      brief: 'Ask a stranger to say the season phrase to camera.',
      guards: ['consent_on_record'],
    },
  },
  {
    id: 'clean-brief-dirty-criterion',
    why: 'Brief is clean; the criterion asks for the excluded thing.',
    task: {
      brief: 'Find a high vantage point and photograph the skyline.',
      guards: ['adults_only'],
      criteria: [{ assert: 'The player is standing on a rooftop ledge.' }],
    },
  },
  {
    id: 'guard-listed-but-wrong-category',
    why: 'Carries a guard, but not one that redeems trespass.',
    task: {
      brief: 'Climb the fence into the yard and take one photo.',
      guards: ['no_contact', 'adults_only', 'outerwear_only'],
    },
  },
  {
    id: 'empty-brief',
    why: 'Nothing to screen — must fail closed rather than pass by default.',
    task: { brief: '   ', guards: ['adults_only'] },
  },
];

/**
 * Tasks that must be **accepted**.
 *
 * A screen that rejects everything is trivially safe and useless. These are
 * lifted from the approved twenty-two, so a change that starts failing them is
 * over-blocking — which shows up as writers switching the screen off.
 */
export const SHOULD_PASS: CorpusEntry[] = [
  {
    id: 'pass-01-heavy',
    why: 'Task 01 — indoors, no risk, no stranger.',
    task: {
      brief:
        'Wear every black item you own. All of it, at once. One photo, standing, head to feet.',
      criteria: [{ assert: 'The clothing is predominantly black.' }],
    },
  },
  {
    id: 'pass-03-nine',
    why: 'Task 03 — observation, entirely indoors.',
    task: {
      brief:
        'Nine things in one room that are exactly the same colour. Arrange them. Shoot from above.',
      criteria: [{ assert: 'At least nine distinct objects, one hue.' }],
    },
  },
  {
    id: 'pass-09-borrowed-guarded',
    why: 'Task 09 as approved — the guards redeem it.',
    task: {
      brief:
        'Convince a stranger to wear your jacket for thirty seconds. Hand it over — do not put it on them.',
      guards: ['adults_only', 'no_contact', 'outerwear_only'],
    },
  },
  {
    id: 'pass-19-the-line',
    why: 'Task 19, the final — stranger-facing and fully guarded.',
    task: {
      brief:
        'Ten strangers. The same three words. One after another, on camera.',
      guards: ['adults_only', 'no_contact', 'consent_on_record'],
    },
  },
];
