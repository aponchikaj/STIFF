/**
 * The catalogue of editable site copy.
 *
 * Every block listed here can be edited from the admin Content tab without a
 * deploy. The registry is the single source of truth for three things at once:
 * what the admin form renders, what the API accepts, and what the site falls
 * back to when a block has never been saved.
 *
 * Adding a new editable block is one entry here plus a `useContent` call on the
 * page — no DTO change, no admin-form change, no migration.
 */

export type ContentFieldType =
  | 'text'
  | 'textarea'
  | 'boolean'
  | 'list'
  /** An uploaded image. Stored as its URL; the admin form offers a file picker. */
  | 'image'
  /** A moment, stored as an ISO 8601 string. Empty means "not set". */
  | 'datetime';

export interface ContentField {
  key: string;
  label: string;
  type: ContentFieldType;
  /** Placeholder / shipped copy. Also the value the site renders unedited. */
  default: string | boolean | ContentListItem[];
  /** Rendered under the input in the admin form. */
  hint?: string;
  maxLength?: number;
}

export interface ContentListItem {
  title: string;
  body: string;
}

export interface ContentBlock {
  key: string;
  label: string;
  /** Groups blocks into sections in the admin form. */
  group: string;
  description?: string;
  fields: ContentField[];
}

export const CONTENT_BLOCKS: ContentBlock[] = [
  {
    key: 'features',
    label: 'Site switches',
    group: 'Site',
    description:
      'When the shop is off, the clothing page, cart and every shop button disappear for visitors.',
    fields: [
      {
        key: 'shopEnabled',
        label: 'Shop is open',
        type: 'boolean',
        default: true,
      },
    ],
  },

  {
    key: 'storefront',
    label: 'Storefront thresholds',
    group: 'Site',
    description:
      'Numbers the shop pages react to. Kept here so they can be tuned without a deploy.',
    fields: [
      {
        key: 'lowStockLabel',
        label: 'Low-stock wording',
        type: 'text',
        hint: 'Use {n} for the number left. Shown once a size drops to the threshold.',
        default: 'Only {n} left',
        maxLength: 60,
      },
      {
        key: 'freeShippingThresholdCents',
        label: 'Free shipping over',
        type: 'text',
        hint: 'Order subtotal, in minor units, above which delivery is free. 0 turns it off.',
        default: '0',
        maxLength: 9,
      },
      {
        key: 'returnWindowDays',
        label: 'Returns window (days)',
        type: 'text',
        hint: 'Days after delivery a customer can still request a return. Keep this in step with the House rules page.',
        default: '14',
        maxLength: 3,
      },
      {
        key: 'cancelWindowStatuses',
        label: 'Cancellable until',
        type: 'text',
        hint: 'Comma-separated order statuses a customer may still cancel from.',
        default: 'pending, paid',
        maxLength: 80,
      },
      {
        key: 'lowStockThreshold',
        label: 'Low-stock threshold',
        type: 'text',
        hint: 'Show the warning when a size has this many units or fewer. 0 turns it off.',
        default: '3',
        maxLength: 4,
      },
    ],
  },

  {
    key: 'home-hero',
    label: 'Home — hero',
    group: 'Home',
    fields: [
      {
        key: 'eyebrow',
        label: 'Eyebrow',
        type: 'text',
        default: 'Tbilisi — est. 2026',
        maxLength: 60,
      },
      {
        key: 'tagline',
        label: 'Tagline',
        type: 'textarea',
        default:
          'Essential clothing. Nothing extra. Heavy fabric, hard cuts, one mark — made to be worn until it falls apart.',
        maxLength: 300,
      },
      {
        key: 'primaryCta',
        label: 'Shop button',
        type: 'text',
        default: 'Shop the drop',
        maxLength: 40,
      },
      {
        key: 'secondaryCta',
        label: 'Archive button',
        type: 'text',
        default: 'See the archive',
        maxLength: 40,
      },
      {
        key: 'coordinates',
        label: 'Footer line',
        type: 'text',
        default: '[ 41.7151° N, 44.8271° E — Tbilisi ]',
        maxLength: 80,
      },
      {
        key: 'image',
        label: 'Backdrop photograph',
        type: 'image',
        hint: 'The full-bleed image behind the wordmark. Landscape, and dark enough for white type to sit on it.',
        default: '/hero-cat.jpg',
        maxLength: 500,
      },
    ],
  },

  {
    key: 'home-drop',
    label: 'Home — drop countdown',
    group: 'Home',
    description:
      'The clock in the hero. Off by default; the state is worked out from the dates, so nothing has to be flipped by hand at midnight.',
    fields: [
      {
        key: 'enabled',
        label: 'Show the countdown',
        type: 'boolean',
        hint: 'Off hides it completely — the hero renders as if there were no drop.',
        default: false,
      },
      {
        key: 'name',
        label: 'Drop name',
        type: 'text',
        default: 'Drop 01',
        maxLength: 60,
      },
      {
        key: 'dropAt',
        label: 'Opens',
        type: 'datetime',
        hint: 'Until this moment the hero counts down. Leave empty and the drop reads as already open.',
        default: '',
      },
      {
        key: 'endsAt',
        label: 'Closes',
        type: 'datetime',
        hint: 'Optional. After this the hero reads as over. Leave empty to run until you switch it off.',
        default: '',
      },
      {
        key: 'soldOut',
        label: 'Sold out',
        type: 'boolean',
        hint: 'Overrides the clock, for when it goes before the closing time.',
        default: false,
      },
      {
        key: 'teaserLabel',
        label: 'Before — label',
        type: 'text',
        default: 'Next drop',
        maxLength: 40,
      },
      {
        key: 'liveLabel',
        label: 'Open — label',
        type: 'text',
        default: 'Live now',
        maxLength: 40,
      },
      {
        key: 'soldOutLabel',
        label: 'Sold out — label',
        type: 'text',
        default: 'Sold out',
        maxLength: 40,
      },
      {
        key: 'endedLabel',
        label: 'Closed — label',
        type: 'text',
        default: 'That drop is over',
        maxLength: 40,
      },
      {
        key: 'closedBody',
        label: 'Sold out / closed — line',
        type: 'text',
        hint: 'Shown under the label once the drop is done.',
        default: 'Small runs, slow drops. The next one is already being cut.',
        maxLength: 160,
      },
    ],
  },

  {
    key: 'home-marquee',
    label: 'Home — scrolling band',
    group: 'Home',
    description:
      'The black band that slides past above and below the page. Each word is preceded by the asterisk.',
    fields: [
      {
        key: 'words',
        label: 'Words',
        type: 'text',
        hint: 'Comma-separated. One word repeats; several cycle — "Stiff, Drop 01, Tbilisi".',
        default: 'Stiff',
        maxLength: 200,
      },
    ],
  },

  {
    key: 'home-sections',
    label: 'Home — section headings',
    group: 'Home',
    description:
      'The numbered acts of the home page. Numbers are worked out as the page renders, so a section that is switched off does not leave a gap.',
    fields: [
      {
        key: 'dropLabel',
        label: 'Drop — label',
        type: 'text',
        default: 'The drop',
        maxLength: 60,
      },
      {
        key: 'dropHeading',
        label: 'Drop — heading',
        type: 'text',
        default: 'Latest pieces',
        maxLength: 80,
      },
      {
        key: 'dropCta',
        label: 'Drop — button',
        type: 'text',
        default: 'Shop all',
        maxLength: 40,
      },
      {
        key: 'wantedLabel',
        label: 'Most wanted — label',
        type: 'text',
        default: 'Most wanted',
        maxLength: 60,
      },
      {
        key: 'wantedHeading',
        label: 'Most wanted — heading',
        type: 'text',
        default: 'What everyone likes',
        maxLength: 80,
      },
      {
        key: 'wantedCta',
        label: 'Most wanted — button',
        type: 'text',
        default: 'See all',
        maxLength: 40,
      },
      {
        key: 'categoriesLabel',
        label: 'Categories — label',
        type: 'text',
        default: 'Shop by category',
        maxLength: 60,
      },
      {
        key: 'archiveLabel',
        label: 'Archive — label',
        type: 'text',
        default: 'The archive',
        maxLength: 60,
      },
      {
        key: 'archiveHeading',
        label: 'Archive — heading',
        type: 'text',
        default: 'Worn, shot, kept',
        maxLength: 80,
      },
      {
        key: 'archiveCta',
        label: 'Archive — button',
        type: 'text',
        default: 'Full gallery',
        maxLength: 40,
      },
      {
        key: 'ideaLabel',
        label: 'The idea — label',
        type: 'text',
        default: 'The idea',
        maxLength: 60,
      },
      {
        key: 'ideaCta',
        label: 'The idea — button',
        type: 'text',
        default: 'Our story',
        maxLength: 40,
      },
      {
        key: 'valuesCta',
        label: 'Values — link',
        type: 'text',
        default: 'Read all the rules →',
        maxLength: 60,
      },
    ],
  },

  {
    key: 'home-values',
    label: 'Home — what we stand for',
    group: 'Home',
    description: 'The inverted black band. Three columns.',
    fields: [
      {
        key: 'eyebrow',
        label: 'Eyebrow',
        type: 'text',
        default: 'The rules we live by',
        maxLength: 60,
      },
      {
        key: 'items',
        label: 'Values',
        type: 'list',
        hint: 'Three reads best. More will wrap.',
        default: [
          {
            title: 'Essential',
            body: "Every piece earns its place. If it doesn't add anything, it doesn't ship.",
          },
          {
            title: 'Heavy',
            body: 'Weight is a feature. Thick cotton, dense embroidery, hardware that clicks.',
          },
          {
            title: 'Ours',
            body: 'Designed and worn in Tbilisi first. The asterisk is the spark.',
          },
        ],
      },
    ],
  },

  {
    key: 'home-join',
    label: 'Home — never miss a drop',
    group: 'Home',
    fields: [
      {
        key: 'title',
        label: 'Headline',
        type: 'text',
        default: 'Never miss a drop',
        maxLength: 80,
      },
      {
        key: 'body',
        label: 'Paragraph',
        type: 'textarea',
        default:
          'Make an account to get notified the second a drop lands, track your orders, and have your say in the comments.',
        maxLength: 400,
      },
    ],
  },

  {
    key: 'about',
    label: 'About page',
    group: 'Pages',
    fields: [
      {
        key: 'title',
        label: 'Headline',
        type: 'text',
        default: 'Nothing extra',
        maxLength: 120,
      },
      {
        key: 'body',
        label: 'Paragraph',
        type: 'textarea',
        default:
          'STIFF started in Tbilisi with one idea: make the few things you actually wear, and make them heavy enough to last.',
        maxLength: 4000,
      },
    ],
  },

  {
    key: 'contact-info',
    label: 'Contact details',
    group: 'Pages',
    fields: [
      {
        key: 'email',
        label: 'Public email',
        type: 'text',
        default: 'stiffenter@gmail.com',
        maxLength: 120,
      },
      {
        key: 'location',
        label: 'Based in',
        type: 'text',
        default: 'Tbilisi, Georgia',
        maxLength: 120,
      },
    ],
  },

  {
    key: 'rules',
    label: 'House rules page',
    group: 'Pages',
    fields: [
      {
        key: 'title',
        label: 'Page heading',
        type: 'text',
        default: 'House rules',
        maxLength: 80,
      },
      {
        key: 'items',
        label: 'The rules',
        type: 'list',
        hint: 'Numbered on the page, in this order.',
        default: [
          {
            title: 'Wear it hard',
            body: 'These pieces are made to be lived in, not archived. Scuffs are proof of use.',
          },
          {
            title: 'Buy less, wear more',
            body: "One heavy tee beats five thin ones. We'd rather sell you fewer things you actually wear.",
          },
          {
            title: 'The asterisk means essential',
            body: "If a detail doesn't earn its place, it gets cut. What's left is marked with *.",
          },
          {
            title: 'No fast fashion',
            body: "Small runs, slow drops. When a drop sells out, it's gone — we move forward, not backward.",
          },
          {
            title: 'Come as you are',
            body: "No gatekeeping. If you wear it, it's yours. Style it wrong on purpose.",
          },
        ],
      },
      {
        key: 'practical',
        label: 'Shipping, returns, care',
        type: 'list',
        default: [
          {
            title: 'Shipping',
            body: 'Pickup in Tbilisi is free. City courier and region delivery rates show at checkout.',
          },
          {
            title: 'Returns',
            body: '14 days, unworn, tags on. Refund to the original payment method within 5 working days of arrival back to us.',
          },
          {
            title: 'Care',
            body: 'Wash cold, inside out. Hang dry — heavy cotton hates the dryer. Iron on the reverse, never on the print.',
          },
        ],
      },
    ],
  },
];

export const CONTENT_KEYS = CONTENT_BLOCKS.map((block) => block.key);

export function findBlock(key: string): ContentBlock | undefined {
  return CONTENT_BLOCKS.find((block) => block.key === key);
}

/** The shipped copy for a block, used when nothing has been saved yet. */
export function defaultsFor(block: ContentBlock): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of block.fields) out[field.key] = field.default;
  return out;
}
