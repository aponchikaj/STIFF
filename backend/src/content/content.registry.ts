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

export type ContentFieldType = 'text' | 'textarea' | 'boolean' | 'list';

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
      { key: 'shopEnabled', label: 'Shop is open', type: 'boolean', default: true },
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
      { key: 'title', label: 'Headline', type: 'text', default: 'Nothing extra', maxLength: 120 },
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
