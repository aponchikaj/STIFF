/**
 * Branded share images, composed in the browser on a canvas.
 *
 * Neither Instagram nor Facebook exposes a web API that posts to Stories, so
 * "share to your story" can only mean: hand the user a finished, on-brand
 * image and get it into the OS share sheet (which lists Instagram/Facebook) or
 * their camera roll. That's what this module produces.
 *
 * Cloudinary serves `access-control-allow-origin: *`, so the source photo can
 * be drawn with `crossOrigin="anonymous"` without tainting the canvas — which
 * is what makes `toBlob` work at the end.
 */

import { imageUrl } from "./image";

export type ShareTemplateId = "frame" | "bleed" | "split" | "post";

export interface ShareTemplate {
  id: ShareTemplateId;
  label: string;
  /** Human hint for where this one is meant to go. */
  hint: string;
  width: number;
  height: number;
}

export const SHARE_TEMPLATES: ShareTemplate[] = [
  { id: "frame", label: "Frame", hint: "Story · 9:16", width: 1080, height: 1920 },
  { id: "bleed", label: "Full bleed", hint: "Story · 9:16", width: 1080, height: 1920 },
  { id: "split", label: "Split", hint: "Story · 9:16", width: 1080, height: 1920 },
  { id: "post", label: "Post", hint: "Feed · 1:1", width: 1080, height: 1080 },
];

export interface ShareSubject {
  /** Archive number ("0042") or product name. */
  title: string;
  imageUrl: string;
  caption?: string | null;
  /** Absolute link printed on the image. */
  url: string;
  /** Small label above/below the title. Defaults to the archive wording. */
  kicker?: string;
  /** Clockwise degrees applied when fetching the source photo. */
  rotation?: number;
}

const INK = "#f5f5f5";
const FIELD = "#0a0a0a";
const PAPER = "#ffffff";
const GRAPHITE = "#0a0a0a";

/** Asterisk outline lifted from ArchivoBlack — same path the site's mark uses. */
const ASTERISK_PATH =
  "M413 637 460 557 348 505 460 454 413 373 312 444 324 322H231L243 444L142 373L95 454L207 505L95 557L142 637L243 566L231 688H324L312 567Z";

/**
 * next/font generates a hashed family name and exposes it as a CSS variable;
 * canvas needs the literal name, so read it back off the document.
 */
function brandFonts(): { display: string; body: string } {
  const styles = getComputedStyle(document.documentElement);
  const display =
    styles.getPropertyValue("--font-archivo-black").trim() || "sans-serif";
  const body = styles.getPropertyValue("--font-archivo").trim() || "sans-serif";
  return { display, body };
}

/** Canvas silently substitutes fonts that aren't loaded yet — force them in. */
async function ensureFonts(fonts: { display: string; body: string }) {
  try {
    await Promise.all([
      document.fonts.load(`400 200px ${fonts.display}`),
      document.fonts.load(`500 40px ${fonts.body}`),
      document.fonts.load(`700 40px ${fonts.body}`),
    ]);
    await document.fonts.ready;
  } catch {
    // Fall back to whatever is resolvable; the layout still holds.
  }
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load the image"));
    img.src = src;
  });
}

/** Draws `img` covering the box, cropping the overflow (CSS object-fit: cover). */
function drawCover(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.max(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

/** Draws `img` fitted inside the box, letterboxed (CSS object-fit: contain). */
function drawContain(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  const scale = Math.min(w / img.width, h / img.height);
  const dw = img.width * scale;
  const dh = img.height * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawAsterisk(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  color: string,
) {
  const path = new Path2D(ASTERISK_PATH);
  ctx.save();
  ctx.fillStyle = color;
  ctx.translate(x, y);
  // The glyph lives in a 365×366 box starting at (95, -688), y-up.
  const scale = size / 365;
  ctx.scale(scale, -scale);
  ctx.translate(-95, 688);
  ctx.fill(path);
  ctx.restore();
}

/** Uppercase label with the brand's wide letterspacing, which canvas lacks. */
function drawTracked(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  tracking: number,
  align: "left" | "right" = "left",
) {
  const chars = [...text];
  const width =
    chars.reduce((sum, c) => sum + ctx.measureText(c).width, 0) +
    tracking * Math.max(0, chars.length - 1);
  let cursor = align === "right" ? x - width : x;
  for (const char of chars) {
    ctx.fillText(char, cursor, y);
    cursor += ctx.measureText(char).width + tracking;
  }
  return width;
}

/**
 * Sets the largest font size at or below `max` that keeps `text` inside
 * `maxWidth`. Archive numbers are short, but product names are not — without
 * this the title runs off the edge of the card.
 */
function fitFont(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  family: string,
  max: number,
  min: number,
): number {
  let size = max;
  while (size > min) {
    ctx.font = `400 ${size}px ${family}`;
    if (ctx.measureText(text).width <= maxWidth) break;
    size -= 4;
  }
  ctx.font = `400 ${size}px ${family}`;
  return size;
}

function truncate(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let out = text;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Strips the scheme so the printed link stays quiet. */
function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

/** Small label under the wordmark; gallery shots keep the archive wording. */
function kickerOf(subject: ShareSubject): string {
  return (subject.kicker ?? "TBILISI — THE ARCHIVE").toUpperCase();
}

interface RenderContext {
  ctx: CanvasRenderingContext2D;
  img: HTMLImageElement;
  subject: ShareSubject;
  fonts: { display: string; body: string };
  w: number;
  h: number;
}

/** Photo inset on a black field, wordmark above, archive data below. */
function renderFrame({ ctx, img, subject, fonts, w, h }: RenderContext) {
  ctx.fillStyle = FIELD;
  ctx.fillRect(0, 0, w, h);

  const margin = 72;
  const top = 300;
  const boxH = 1180;

  ctx.fillStyle = "#141414";
  ctx.fillRect(margin, top, w - margin * 2, boxH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin, top, w - margin * 2, boxH);
  ctx.clip();
  drawCover(ctx, img, margin, top, w - margin * 2, boxH);
  ctx.restore();

  // Wordmark + mark
  ctx.fillStyle = INK;
  ctx.font = `400 116px ${fonts.display}`;
  ctx.textBaseline = "alphabetic";
  drawTracked(ctx, "STIFF", margin, 200, 6);
  drawAsterisk(ctx, w - margin - 92, 108, 92, INK);

  ctx.font = `500 28px ${fonts.body}`;
  ctx.fillStyle = "#a1a1aa";
  drawTracked(ctx, kickerOf(subject), margin, 250, 7);

  // Title, shrunk to fit if it is a long product name.
  ctx.fillStyle = INK;
  fitFont(ctx, subject.title, w - margin * 2, fonts.display, 150, 54);
  ctx.fillText(subject.title, margin, top + boxH + 168);

  ctx.font = `500 28px ${fonts.body}`;
  ctx.fillStyle = "#a1a1aa";
  drawTracked(ctx, displayUrl(subject.url).toUpperCase(), margin, h - 96, 5);
}

/** Photo fills the frame; type sits over a scrim at the foot. */
function renderBleed({ ctx, img, subject, fonts, w, h }: RenderContext) {
  ctx.fillStyle = FIELD;
  ctx.fillRect(0, 0, w, h);
  drawCover(ctx, img, 0, 0, w, h);

  // Top and bottom scrims keep the type legible over any photo.
  const top = ctx.createLinearGradient(0, 0, 0, 420);
  top.addColorStop(0, "rgba(10,10,10,0.85)");
  top.addColorStop(1, "rgba(10,10,10,0)");
  ctx.fillStyle = top;
  ctx.fillRect(0, 0, w, 420);

  const bottom = ctx.createLinearGradient(0, h - 720, 0, h);
  bottom.addColorStop(0, "rgba(10,10,10,0)");
  bottom.addColorStop(0.55, "rgba(10,10,10,0.8)");
  bottom.addColorStop(1, "rgba(10,10,10,0.96)");
  ctx.fillStyle = bottom;
  ctx.fillRect(0, h - 720, w, 720);

  const margin = 72;

  ctx.fillStyle = INK;
  ctx.font = `400 92px ${fonts.display}`;
  drawTracked(ctx, "STIFF", margin, 180, 5);
  drawAsterisk(ctx, w - margin - 76, 108, 76, INK);

  fitFont(ctx, subject.title, w - margin * 2, fonts.display, 210, 56);
  ctx.fillText(subject.title, margin, h - 250);

  ctx.font = `500 30px ${fonts.body}`;
  ctx.fillStyle = "#d4d4d8";
  drawTracked(ctx, kickerOf(subject), margin, h - 186, 8);

  ctx.font = `500 28px ${fonts.body}`;
  ctx.fillStyle = "#a1a1aa";
  drawTracked(ctx, displayUrl(subject.url).toUpperCase(), margin, h - 100, 5);
}

/** Photo on top, a hard white block beneath — the most brutalist of the three. */
function renderSplit({ ctx, img, subject, fonts, w, h }: RenderContext) {
  const photoH = Math.round(h * 0.64);

  ctx.fillStyle = GRAPHITE;
  ctx.fillRect(0, 0, w, photoH);
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, 0, w, photoH);
  ctx.clip();
  drawCover(ctx, img, 0, 0, w, photoH);
  ctx.restore();

  ctx.fillStyle = PAPER;
  ctx.fillRect(0, photoH, w, h - photoH);

  const margin = 72;

  ctx.fillStyle = GRAPHITE;
  fitFont(ctx, subject.title, w - margin * 2, fonts.display, 240, 56);
  ctx.fillText(subject.title, margin, photoH + 232);

  ctx.font = `500 30px ${fonts.body}`;
  ctx.fillStyle = "#3f3f46";
  drawTracked(ctx, `STIFF — ${kickerOf(subject)}`, margin, photoH + 300, 8);

  if (subject.caption) {
    ctx.font = `400 34px ${fonts.body}`;
    ctx.fillStyle = "#3f3f46";
    ctx.fillText(
      truncate(ctx, subject.caption, w - margin * 2),
      margin,
      photoH + 372,
    );
  }

  drawAsterisk(ctx, w - margin - 72, h - 152, 72, GRAPHITE);

  ctx.font = `500 28px ${fonts.body}`;
  ctx.fillStyle = "#3f3f46";
  drawTracked(ctx, displayUrl(subject.url).toUpperCase(), margin, h - 92, 5);
}

/** Square feed card: whole photo visible, brand bar beneath. */
function renderPost({ ctx, img, subject, fonts, w, h }: RenderContext) {
  ctx.fillStyle = FIELD;
  ctx.fillRect(0, 0, w, h);

  const barH = 132;
  drawContain(ctx, img, 0, 0, w, h - barH);

  ctx.fillStyle = INK;
  ctx.font = `400 52px ${fonts.display}`;
  ctx.textBaseline = "middle";
  drawTracked(ctx, "STIFF", 56, h - barH / 2, 4);

  ctx.font = `500 30px ${fonts.body}`;
  ctx.fillStyle = "#a1a1aa";
  drawTracked(
    ctx,
    truncate(ctx, subject.title.toUpperCase(), w - 380),
    w - 56,
    h - barH / 2,
    6,
    "right",
  );
  ctx.textBaseline = "alphabetic";
}

const RENDERERS: Record<ShareTemplateId, (c: RenderContext) => void> = {
  frame: renderFrame,
  bleed: renderBleed,
  split: renderSplit,
  post: renderPost,
};

/** Renders `subject` with `template` and resolves a PNG blob. */
export async function renderShareImage(
  subject: ShareSubject,
  templateId: ShareTemplateId,
): Promise<Blob> {
  const template =
    SHARE_TEMPLATES.find((t) => t.id === templateId) ?? SHARE_TEMPLATES[0];
  const fonts = brandFonts();

  // Request a render wide enough for the largest box the templates draw into.
  const [img] = await Promise.all([
    loadImage(imageUrl(subject.imageUrl, 1440, "detail", subject.rotation ?? 0)),
    ensureFonts(fonts),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = template.width;
  canvas.height = template.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is unavailable in this browser");

  RENDERERS[template.id]({
    ctx,
    img,
    subject,
    fonts,
    w: template.width,
    h: template.height,
  });

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve(blob) : reject(new Error("Could not build the image")),
      "image/png",
    );
  });
}

export function shareFileName(subject: ShareSubject, id: ShareTemplateId) {
  return `stiff-${subject.title}-${id}.png`;
}
