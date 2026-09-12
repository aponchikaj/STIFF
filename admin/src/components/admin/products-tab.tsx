"use client";

import { useRef, useState } from "react";
import { adminApi, productsApi } from "@/lib/api";
import type { Product } from "@/lib/api";
import { variantLabel } from "@/lib/checkout";
import { formatPrice } from "@/lib/format";
import { errorMessage, useAsync } from "@/lib/hooks";
import { imageUrl } from "@/lib/image";
import { AsteriskMark } from "../asterisk-mark";
import {
  Badge,
  btnDanger,
  btnGhost,
  btnPrimary,
  btnPrimarySm,
  btnSecondary,
  btnSecondarySm,
  chipCls,
  Empty,
  ErrorNote,
  eyebrow,
  Field,
  inputCls,
  labelCls,
  Loading,
  Note,
  Panel,
  tableCls,
  TableScroll,
  tdCls,
  textareaCls,
  thCls,
  theadCls,
  trCls,
} from "../ui";

/** One row of the variants editor. Strings because they come from inputs. */
interface VariantRow {
  id?: string;
  size: string;
  /** Empty for a product sold in one colour — most of them. */
  color: string;
  colorHex: string;
  /** Photos of this colourway. Empty falls back to the product's own. */
  images: string[];
  sku: string;
  stock: string;
  priceDelta: string;
  isActive: boolean;
}

function blankVariant(size = "", color = ""): VariantRow {
  return {
    size,
    color,
    colorHex: "",
    images: [],
    sku: "",
    stock: "0",
    priceDelta: "0",
    isActive: true,
  };
}

const DEFAULT_VARIANTS: VariantRow[] = ["S", "M", "L", "XL"].map((s) =>
  blankVariant(s),
);

const EMPTY = {
  name: "",
  category: "",
  price: "",
  description: "",
  images: [] as string[],
  imageAlts: [] as string[],
  variants: DEFAULT_VARIANTS,
  publishAt: "",
};

/** Where "nearly gone" starts. Display only — nothing is gated on it. */
const LOW_STOCK = 5;

/**
 * The editor's own table metrics.
 *
 * `tdCls` is sized for a bleed table that runs to the card's edge; this one
 * sits inside the form's padding, so it flushes left instead.
 */
const editThCls = "px-2 py-2 font-bold first:pl-0 last:pr-0";
const editTdCls = "px-2 py-2 align-middle first:pl-0 last:pr-0";

/**
 * A labelled block of the form.
 *
 * The legend is the real one, for a screen reader; the eyebrow beside it is
 * the one you see. Keeping them apart is what lets the divider be a plain
 * top border — a rendered `<legend>` would sit on the line and break it.
 */
function FormSection({
  title,
  hint,
  first = false,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  first?: boolean;
  children: React.ReactNode;
}) {
  return (
    <fieldset className={first ? "min-w-0" : "min-w-0 border-t border-line pt-5"}>
      <legend className="sr-only">{title}</legend>
      <p className={eyebrow} aria-hidden="true">
        {title}
      </p>
      {hint && (
        <p className="mt-2 max-w-[80ch] text-[12px] leading-5 text-muted">
          {hint}
        </p>
      )}
      <div className="mt-4">{children}</div>
    </fieldset>
  );
}

/** What a row in the list is doing right now, in one word. */
function statusOf(product: Product): { tone: "neutral" | "positive" | "caution" | "danger" | "info"; label: string } {
  if (!product.isActive) return { tone: "neutral", label: "Archived" };
  if (product.publishAt && new Date(product.publishAt) > new Date())
    return { tone: "info", label: "Scheduled" };
  if (product.stock === 0) return { tone: "danger", label: "Sold out" };
  if (product.stock <= LOW_STOCK) return { tone: "caution", label: "Low stock" };
  return { tone: "positive", label: "Live" };
}

/** The per-variant stock line, the same text the grid used to show. */
function stockBreakdown(product: Product): string | null {
  if (!product.variants.some((v) => v.size || v.color)) return null;
  return product.variants
    .map(
      (v) =>
        `${variantLabel(v.color, v.size) || "One size"} ${v.stock}${
          v.isActive ? "" : " (retired)"
        }`,
    )
    .join(" · ");
}

export function ProductsTab() {
  const [page, setPage] = useState(1);
  const { data, loading, error, reload } = useAsync(
    () => productsApi.listProducts({ page, pageSize: 12, sort: "newest" }),
    [page],
  );
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const pageCount = Math.max(1, Math.ceil((data?.total ?? 0) / 12));

  function startCreate() {
    setEditingId(null);
    setForm(EMPTY);
    setShowForm(true);
  }

  function startEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      name: product.name,
      category: product.category ?? "",
      price: String(product.priceCents / 100),
      description: product.description,
      images: product.images,
      imageAlts: product.images.map((_, i) => product.imageAlts?.[i] ?? ""),
      // datetime-local wants no timezone suffix.
      publishAt: product.publishAt
        ? new Date(product.publishAt).toISOString().slice(0, 16)
        : "",
      variants:
        product.variants.length > 0
          ? product.variants.map((v) => ({
              id: v.id,
              size: v.size,
              color: v.color ?? "",
              colorHex: v.colorHex ?? "",
              images: v.images ?? [],
              sku: v.sku ?? "",
              stock: String(v.stock),
              priceDelta: String(v.priceDeltaCents / 100),
              isActive: v.isActive,
            }))
          : [blankVariant()],
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function patchVariant(index: number, next: Partial<VariantRow>) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v, i) => (i === index ? { ...v, ...next } : v)),
    }));
  }

  /**
   * Photos belong to a colourway, not to one of its size rows.
   *
   * The column lives on the variant because that is what an order line points
   * at, so setting it writes the same list onto every row of the colour —
   * otherwise the shopper would see different pictures depending on which
   * size happened to be selected.
   */
  function setColourImages(color: string, images: string[]) {
    setForm((f) => ({
      ...f,
      variants: f.variants.map((v) =>
        v.color.trim() === color ? { ...v, images } : v,
      ),
    }));
  }

  /** Every named colour in the form, first-seen order. */
  function namedColours(rows: VariantRow[]): string[] {
    return [
      ...new Set(rows.map((v) => v.color.trim()).filter((c) => c !== "")),
    ];
  }

  /** Repeats the current size set under a new colour, ready to be renamed. */
  function addColour() {
    setForm((f) => {
      const sizes = [...new Set(f.variants.map((v) => v.size.trim()))];
      const existing = namedColours(f.variants);
      const name = `Colour ${existing.length + 1}`;
      return {
        ...f,
        variants: [...f.variants, ...sizes.map((size) => blankVariant(size, name))],
      };
    });
  }

  async function uploadColourImages(color: string, files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNote(null);
    try {
      const added: string[] = [];
      for (const file of Array.from(files)) {
        const { url } = await adminApi.uploadImage(file);
        added.push(url);
      }
      setForm((f) => {
        const current =
          f.variants.find((v) => v.color.trim() === color)?.images ?? [];
        const images = [...current, ...added];
        return {
          ...f,
          variants: f.variants.map((v) =>
            v.color.trim() === color ? { ...v, images } : v,
          ),
        };
      });
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  function moveVariant(from: number, to: number) {
    setForm((f) => {
      if (to < 0 || to >= f.variants.length) return f;
      const variants = [...f.variants];
      const [moved] = variants.splice(from, 1);
      variants.splice(to, 0, moved);
      return { ...f, variants };
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(EMPTY);
  }

  async function upload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setNote(null);
    try {
      for (const file of Array.from(files)) {
        const { url } = await adminApi.uploadImage(file);
        // Alts grow with the images so index N never describes photo N-1.
        setForm((f) => ({
          ...f,
          images: [...f.images, url],
          imageAlts: [...f.imageAlts, ""],
        }));
      }
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function save(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setNote(null);
    const payload = {
      name: form.name,
      category: form.category || undefined,
      priceCents: Math.round(Number(form.price) * 100),
      // The backend derives `sizes` and the stock total from these.
      variants: form.variants.map((v) => ({
        id: v.id,
        size: v.size.trim(),
        color: v.color.trim(),
        colorHex: v.colorHex.trim() || null,
        images: v.images,
        sku: v.sku.trim() || undefined,
        stock: Number(v.stock) || 0,
        priceDeltaCents: Math.round(Number(v.priceDelta) * 100) || 0,
        isActive: v.isActive,
      })),
      description: form.description || undefined,
      images: form.images,
      imageAlts: form.images.map((_, i) => form.imageAlts[i] ?? ""),
      publishAt: form.publishAt
        ? new Date(form.publishAt).toISOString()
        : null,
    };
    try {
      if (editingId) {
        await adminApi.updateProduct(editingId, payload);
        setNote("Product updated.");
      } else {
        await adminApi.createProduct(payload);
        setNote("Product created.");
      }
      closeForm();
      reload();
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  const colours = namedColours(form.variants);
  const totalStock = form.variants.reduce(
    (sum, v) => sum + (Number(v.stock) || 0),
    0,
  );

  return (
    <div className="flex flex-col gap-5">
      <Note>{note}</Note>

      {showForm && (
        <Panel
          eyebrow={editingId ? "Editing" : "New"}
          title={editingId ? form.name || "Untitled product" : "New product"}
          aside={
            <button type="button" onClick={closeForm} className={btnGhost}>
              Close
            </button>
          }
        >
          <form onSubmit={save} className="flex flex-col gap-5">
            <FormSection title="The basics" first>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field id="p-name" label="Name">
                  <input
                    id="p-name"
                    required
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className={inputCls}
                  />
                </Field>
                <Field id="p-category" label="Category">
                  <input
                    id="p-category"
                    list="category-options"
                    value={form.category}
                    onChange={(e) =>
                      setForm({ ...form, category: e.target.value })
                    }
                    placeholder="Tees / Hoodies / Pants"
                    className={inputCls}
                  />
                  <datalist id="category-options">
                    <option value="Tees" />
                    <option value="Hoodies" />
                    <option value="Pants" />
                    <option value="Accessories" />
                  </datalist>
                </Field>
                <div className="sm:col-span-2 lg:col-span-3">
                  <Field id="p-description" label="Description">
                    <textarea
                      id="p-description"
                      rows={3}
                      value={form.description}
                      onChange={(e) =>
                        setForm({ ...form, description: e.target.value })
                      }
                      className={textareaCls}
                    />
                  </Field>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Pricing and the drop"
              hint="Leave the go-live time empty to publish as soon as the product is active. Shoppers cannot see it before that moment even if it is."
            >
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Field id="p-price" label="Price (₾)">
                  <input
                    id="p-price"
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.price}
                    onChange={(e) => setForm({ ...form, price: e.target.value })}
                    className={`${inputCls} tnum`}
                  />
                </Field>
                <Field id="p-publish" label="Go live at">
                  <input
                    id="p-publish"
                    type="datetime-local"
                    value={form.publishAt}
                    onChange={(e) =>
                      setForm({ ...form, publishAt: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <div className="flex flex-col justify-end">
                  <p className={labelCls}>Total stock</p>
                  <p className="font-display tnum mt-1.5 text-[22px] leading-none">
                    {totalStock}
                  </p>
                  <p className="mt-1.5 text-[11px] leading-5 text-faint">
                    Summed from the rows below.
                  </p>
                </div>
              </div>
            </FormSection>

            <FormSection
              title="Images"
              hint="Describe each photo. Screen readers and Google both read it, and it is what shows if the image fails to load."
            >
              <div className="flex flex-wrap gap-4">
                {form.images.map((url, index) => (
                  <div key={`${url}-${index}`} className="w-40">
                    <div className="relative w-20">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imageUrl(url, 160)}
                        alt={form.imageAlts[index] || ""}
                        loading="lazy"
                        decoding="async"
                        className="size-20 rounded-[var(--radius-control)] bg-raised object-cover"
                      />
                      <button
                        type="button"
                        aria-label="Remove image"
                        onClick={() =>
                          setForm((f) => ({
                            ...f,
                            images: f.images.filter((_, i) => i !== index),
                            imageAlts: f.imageAlts.filter((_, i) => i !== index),
                          }))
                        }
                        className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[var(--radius-control)] bg-ink text-[10px] font-bold text-card"
                      >
                        ×
                      </button>
                    </div>
                    <label className="sr-only" htmlFor={`p-alt-${index}`}>
                      Description for photo {index + 1}
                    </label>
                    <input
                      id={`p-alt-${index}`}
                      value={form.imageAlts[index] ?? ""}
                      maxLength={300}
                      placeholder="Bone jacket, front"
                      onChange={(e) =>
                        setForm((f) => {
                          const imageAlts = [...f.imageAlts];
                          imageAlts[index] = e.target.value;
                          return { ...f, imageAlts };
                        })
                      }
                      className={`${inputCls} mt-2 text-[11px]`}
                    />
                  </div>
                ))}
                <label className="inline-flex size-20 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-line-strong text-[10px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:border-ink hover:text-ink">
                  {uploading ? "…" : "+ Add"}
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    multiple
                    onChange={(e) => upload(e.target.files)}
                    className="sr-only"
                  />
                </label>
              </div>
            </FormSection>

            <FormSection
              title="Colours, sizes and stock"
              hint={
                <>
                  One row per colour and size — that pair is what gets bought,
                  and what holds stock. Leave colour empty for a piece sold in
                  one colour, and size empty for one sold in one size. Price
                  adjust is added to the price above, for when a size costs
                  more. Never make a second product for a second colour: it
                  splits the likes, comments and archive links of one garment
                  in half.
                </>
              }
            >
              <TableScroll>
                <table className={`${tableCls} min-w-[900px]`}>
                  <thead className={theadCls}>
                    <tr>
                      <th className={editThCls}>Colour</th>
                      <th className={`${editThCls} w-[4.5rem]`}>Swatch</th>
                      <th className={`${editThCls} w-24`}>Size</th>
                      <th className={editThCls}>SKU</th>
                      <th className={`${editThCls} w-24`}>Stock</th>
                      <th className={`${editThCls} w-28`}>Price adjust</th>
                      <th className={editThCls}>
                        <span className="sr-only">Row actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {form.variants.map((variant, i) => (
                      <tr key={i} className="border-t border-line">
                        <td className={editTdCls}>
                          <label className="sr-only" htmlFor={`v-color-${i}`}>
                            Colour
                          </label>
                          <input
                            id={`v-color-${i}`}
                            value={variant.color}
                            placeholder="one colour"
                            onChange={(e) =>
                              patchVariant(i, { color: e.target.value })
                            }
                            className={inputCls}
                          />
                        </td>
                        <td className={editTdCls}>
                          <label className="sr-only" htmlFor={`v-hex-${i}`}>
                            Swatch
                          </label>
                          <input
                            id={`v-hex-${i}`}
                            type="color"
                            value={variant.colorHex || "#000000"}
                            disabled={!variant.color.trim()}
                            title={
                              variant.color.trim()
                                ? "Swatch shown in the colour picker"
                                : "Name the colour first"
                            }
                            onChange={(e) =>
                              patchVariant(i, { colorHex: e.target.value })
                            }
                            className="h-10 w-full cursor-pointer rounded-[var(--radius-control)] border border-line bg-card p-1 disabled:cursor-not-allowed disabled:opacity-40"
                          />
                        </td>
                        <td className={editTdCls}>
                          <label className="sr-only" htmlFor={`v-size-${i}`}>
                            Size
                          </label>
                          <input
                            id={`v-size-${i}`}
                            value={variant.size}
                            placeholder="M"
                            onChange={(e) =>
                              patchVariant(i, { size: e.target.value })
                            }
                            className={inputCls}
                          />
                        </td>
                        <td className={editTdCls}>
                          <label className="sr-only" htmlFor={`v-sku-${i}`}>
                            SKU
                          </label>
                          <input
                            id={`v-sku-${i}`}
                            value={variant.sku}
                            placeholder="optional"
                            onChange={(e) =>
                              patchVariant(i, { sku: e.target.value })
                            }
                            className={inputCls}
                          />
                        </td>
                        <td className={editTdCls}>
                          <label className="sr-only" htmlFor={`v-stock-${i}`}>
                            Stock
                          </label>
                          <input
                            id={`v-stock-${i}`}
                            type="number"
                            min="0"
                            value={variant.stock}
                            onChange={(e) =>
                              patchVariant(i, { stock: e.target.value })
                            }
                            className={`${inputCls} tnum`}
                          />
                        </td>
                        <td className={editTdCls}>
                          <label className="sr-only" htmlFor={`v-delta-${i}`}>
                            Price adjust
                          </label>
                          <input
                            id={`v-delta-${i}`}
                            type="number"
                            step="0.01"
                            value={variant.priceDelta}
                            onChange={(e) =>
                              patchVariant(i, { priceDelta: e.target.value })
                            }
                            className={`${inputCls} tnum`}
                          />
                        </td>
                        <td className={editTdCls}>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className={chipCls(variant.isActive)}
                              aria-pressed={variant.isActive}
                              title={
                                variant.isActive
                                  ? "Selling — click to retire this size"
                                  : "Retired — click to sell it again"
                              }
                              onClick={() =>
                                patchVariant(i, { isActive: !variant.isActive })
                              }
                            >
                              {variant.isActive ? "Selling" : "Retired"}
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              disabled={i === 0}
                              aria-label={`Move ${variant.size || "row"} up`}
                              onClick={() => moveVariant(i, i - 1)}
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              disabled={i === form.variants.length - 1}
                              aria-label={`Move ${variant.size || "row"} down`}
                              onClick={() => moveVariant(i, i + 1)}
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className={btnGhost}
                              disabled={form.variants.length === 1}
                              aria-label={`Remove ${variant.size || "row"}`}
                              onClick={() =>
                                setForm((f) => ({
                                  ...f,
                                  variants: f.variants.filter(
                                    (_, j) => j !== i,
                                  ),
                                }))
                              }
                            >
                              Remove
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </TableScroll>

              <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={btnSecondarySm}
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        variants: [...f.variants, blankVariant()],
                      }))
                    }
                  >
                    Add size
                  </button>
                  <button
                    type="button"
                    className={btnSecondarySm}
                    onClick={addColour}
                    title="Repeats the sizes above under a new colour"
                  >
                    Add colour
                  </button>
                </div>
                <p className="text-[12px] text-muted">
                  Total stock{" "}
                  <span className="tnum font-bold text-ink">{totalStock}</span>
                </p>
              </div>

              {colours.length > 0 && (
                <div className="mt-5 rounded-[var(--radius-control)] border border-line bg-raised p-4">
                  <p className={labelCls}>Photos per colour</p>
                  <p className="mt-1.5 max-w-[80ch] text-[12px] leading-5 text-muted">
                    A colour with its own photos shows those instead of the
                    product images above — not as well as them. Leave a colour
                    empty to use the product photos.
                  </p>
                  <div className="mt-4 flex flex-col gap-4">
                    {colours.map((color) => {
                      const images =
                        form.variants.find((v) => v.color.trim() === color)
                          ?.images ?? [];
                      return (
                        <div key={color}>
                          <p className="flex flex-wrap items-baseline gap-2">
                            <span className="text-[12px] font-bold">
                              {color}
                            </span>
                            <span className="text-[11px] text-faint">
                              {images.length === 0
                                ? "using product photos"
                                : `${images.length} photo${images.length === 1 ? "" : "s"}`}
                            </span>
                          </p>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {images.map((url, index) => (
                              <div key={`${url}-${index}`} className="relative">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imageUrl(url, 160)}
                                  alt={`${color} — photo ${index + 1}`}
                                  loading="lazy"
                                  decoding="async"
                                  className="size-16 rounded-[var(--radius-control)] bg-card object-cover"
                                />
                                <button
                                  type="button"
                                  aria-label={`Remove ${color} photo ${index + 1}`}
                                  onClick={() =>
                                    setColourImages(
                                      color,
                                      images.filter((_, i) => i !== index),
                                    )
                                  }
                                  className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[var(--radius-control)] bg-ink text-[10px] font-bold text-card"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                            <label className="inline-flex size-16 cursor-pointer flex-col items-center justify-center rounded-[var(--radius-control)] border border-dashed border-line-strong text-[10px] font-semibold uppercase tracking-[0.08em] text-muted transition-colors hover:border-ink hover:text-ink">
                              {uploading ? "…" : "+ Add"}
                              <input
                                type="file"
                                accept="image/jpeg,image/png,image/webp"
                                multiple
                                onChange={(e) =>
                                  uploadColourImages(color, e.target.files)
                                }
                                className="sr-only"
                              />
                            </label>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </FormSection>

            <div className="flex flex-wrap items-center gap-3 border-t border-line pt-5">
              <button
                type="submit"
                disabled={busy || uploading}
                className={btnPrimary}
              >
                {busy
                  ? "Saving…"
                  : editingId
                    ? "Save changes"
                    : "Create product"}
              </button>
              <button
                type="button"
                onClick={closeForm}
                className={btnSecondary}
              >
                Cancel
              </button>
            </div>
          </form>
        </Panel>
      )}

      <Panel
        bleed
        eyebrow="Catalog"
        title={`${data?.total ?? 0} product${(data?.total ?? 0) === 1 ? "" : "s"}`}
        aside={
          <button
            type="button"
            onClick={() => (showForm ? closeForm() : startCreate())}
            className={btnPrimarySm}
          >
            {showForm ? "Close form" : "+ New product"}
          </button>
        }
      >
        {loading && (
          <div className="px-5">
            <Loading label="Loading products" />
          </div>
        )}
        {error && (
          <div className="px-5 pb-5">
            <ErrorNote message={error} />
          </div>
        )}
        {data && data.items.length === 0 && !loading && (
          <Empty
            action={
              <button
                type="button"
                onClick={startCreate}
                className={btnPrimarySm}
              >
                + New product
              </button>
            }
          >
            No products yet — the catalog starts with the first one.
          </Empty>
        )}

        {data && data.items.length > 0 && (
          <TableScroll>
            <table className={tableCls}>
              <thead className={theadCls}>
                <tr className="border-t border-line">
                  <th className={thCls}>Product</th>
                  <th className={`${thCls} hidden md:table-cell`}>Category</th>
                  <th className={thCls}>Price</th>
                  <th className={thCls}>Stock</th>
                  <th className={`${thCls} hidden lg:table-cell`}>Reactions</th>
                  <th className={thCls}>Status</th>
                  <th className={thCls}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((product) => {
                  const status = statusOf(product);
                  const breakdown = stockBreakdown(product);
                  return (
                    <tr key={product.id} className={trCls}>
                      <td className={tdCls}>
                        <div className="flex min-w-0 items-center gap-3">
                          {product.images[0] ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={imageUrl(product.images[0], 160)}
                              alt=""
                              loading="lazy"
                              decoding="async"
                              className="size-11 shrink-0 rounded-[var(--radius-control)] bg-raised object-cover"
                            />
                          ) : (
                            <span className="flex size-11 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-raised">
                              <AsteriskMark className="size-4 text-line-strong" />
                            </span>
                          )}
                          <span className="min-w-0">
                            <span className="block truncate font-bold">
                              {product.name}
                            </span>
                            <span className="block truncate text-[11px] text-faint">
                              {product.slug}
                            </span>
                          </span>
                        </div>
                      </td>
                      <td className={`${tdCls} hidden md:table-cell`}>
                        <span className="text-muted">
                          {product.category ?? "—"}
                        </span>
                      </td>
                      <td className={`${tdCls} tnum whitespace-nowrap`}>
                        {formatPrice(product.priceCents)}
                      </td>
                      <td className={tdCls}>
                        <span className="tnum">{product.stock}</span>
                        {breakdown && (
                          <span
                            className="block max-w-[24ch] truncate text-[11px] text-faint"
                            title={breakdown}
                          >
                            {breakdown}
                          </span>
                        )}
                      </td>
                      <td
                        className={`${tdCls} tnum hidden whitespace-nowrap text-[11px] text-faint lg:table-cell`}
                      >
                        ♥ {product.likeCount} · 💬 {product.commentCount}
                      </td>
                      <td className={tdCls}>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </td>
                      <td className={tdCls}>
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => startEdit(product)}
                            className={btnSecondarySm}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              setNote(null);
                              try {
                                await adminApi.updateProduct(product.id, {
                                  isActive: !product.isActive,
                                });
                                reload();
                              } catch (err) {
                                setNote(errorMessage(err));
                              }
                            }}
                            className={btnGhost}
                          >
                            {product.isActive ? "Archive" : "Unarchive"}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!confirm(`Delete ${product.name}?`)) return;
                              setNote(null);
                              try {
                                await adminApi.deleteProduct(product.id);
                                reload();
                              } catch (err) {
                                setNote(errorMessage(err));
                              }
                            }}
                            className={btnDanger}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        )}

        {pageCount > 1 && (
          <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className={btnSecondarySm}
            >
              ← Prev
            </button>
            <span className={`${eyebrow} tnum`}>
              {page} / {pageCount}
            </span>
            <button
              type="button"
              disabled={page >= pageCount}
              onClick={() => setPage((p) => p + 1)}
              className={btnSecondarySm}
            >
              Next →
            </button>
          </div>
        )}
      </Panel>
    </div>
  );
}
