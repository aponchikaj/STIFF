/**
 * The numbered acts of the home page.
 *
 * The numbers used to be typed into the markup, with a constant in the eyebrow
 * component subtracting three when the shop was switched off. That worked only
 * as long as exactly three shop-gated sections existed, and it put the page's
 * structure in two places that had to agree — so the day a section moved, the
 * page silently ran 01, 02, 03, 03, 04.
 *
 * Here the order is a list, the rendered subset is derived from it, and the
 * number is that subset's index. A section that does not render cannot leave a
 * gap, because nothing counts it.
 */

export const HOME_SECTIONS = [
  "drop",
  "wanted",
  "categories",
  "archive",
  "idea",
  "values",
] as const;

export type HomeSection = (typeof HOME_SECTIONS)[number];

/** The three acts that only exist while the shop is open. */
const SHOP_ONLY: readonly HomeSection[] = ["drop", "wanted", "categories"];

/**
 * A numbering function for one render of the page.
 *
 * Returns "01", "02", … in the order sections actually appear, and an empty
 * string for a section that is not being rendered at all — which never happens
 * in practice, because the caller only asks about what it is drawing.
 */
export function sectionNumbers(shopEnabled: boolean) {
  const shown = HOME_SECTIONS.filter(
    (section) => shopEnabled || !SHOP_ONLY.includes(section),
  );
  return (section: HomeSection): string => {
    const index = shown.indexOf(section);
    return index === -1 ? "" : String(index + 1).padStart(2, "0");
  };
}
