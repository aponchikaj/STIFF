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
  btnGhostSm,
  btnOutline,
  btnSolidSm,
  ErrorNote,
  Field,
  inputCls,
  labelCls,
  Loading,
  textareaCls,
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
  preorderEnabled: false,
  preorderShipsAt: "",
  preorderLimit: "",
};

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
      preorderEnabled: product.preorderEnabled ?? false,
      preorderShipsAt: product.preorderShipsAt ?? "",
      preorderLimit: product.preorderLimit ? String(product.preorderLimit) : "",
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
      preorderEnabled: form.preorderEnabled,
      preorderShipsAt: form.preorderShipsAt || undefined,
      preorderLimit: Number(form.preorderLimit) || 0,
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

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className={labelCls}>Catalog — {data?.total ?? 0} products</p>
        <button
          type="button"
          onClick={() => (showForm ? closeForm() : startCreate())}
          className={btnSolidSm}
        >
          {showForm ? "Close form" : "+ New product"}
        </button>
      </div>
      <p aria-live="polite" className="-mt-6 min-h-4 text-xs text-muted">
        {note}
      </p>

      {showForm && (
        <form
          onSubmit={save}
          className="flex flex-col gap-4 border border-subtle p-4 sm:p-6"
        >
          <p className={labelCls}>
            {editingId ? `Editing: ${form.name}` : "New product"}
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
            <Field id="p-price" label="Price (₾)">
              <input
                id="p-price"
                required
                type="number"
                min="0"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                className={inputCls}
              />
            </Field>
          </div>
          <div className="grid gap-4">
            <Field id="p-description" label="Description">
              <textarea
                id="p-description"
                rows={2}
                value={form.description}
                onChange={(e) =>
                  setForm({ ...form, description: e.target.value })
                }
                className={textareaCls}
              />
            </Field>
          </div>

          <fieldset className="border border-subtle p-4">
            <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Colours, sizes and stock
            </legend>
            <p className="text-xs leading-6 text-muted">
              One row per colour and size — that pair is what gets bought, and
              what holds stock. Leave colour empty for a piece sold in one
              colour, and size empty for one sold in one size. Price adjust is
              added to the price above, for when a size costs more.
            </p>
            <p className="mt-1 text-xs leading-6 text-muted">
              Never make a second product for a second colour: it splits the
              likes, comments and archive links of one garment in half.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {form.variants.map((variant, i) => (
                <div
                  key={i}
                  className="grid grid-cols-2 items-end gap-2 border-t border-subtle pt-3 sm:grid-cols-[7rem_3rem_5rem_1fr_5rem_6rem_auto]"
                >
                  <Field id={`v-color-${i}`} label="Colour">
                    <input
                      id={`v-color-${i}`}
                      value={variant.color}
                      placeholder="one colour"
                      onChange={(e) =>
                        patchVariant(i, { color: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <Field id={`v-hex-${i}`} label="Swatch">
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
                      className="h-11 w-full cursor-pointer rounded-[2px] border border-subtle bg-surface p-1 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                  </Field>
                  <Field id={`v-size-${i}`} label="Size">
                    <input
                      id={`v-size-${i}`}
                      value={variant.size}
                      placeholder="M"
                      onChange={(e) => patchVariant(i, { size: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field id={`v-sku-${i}`} label="SKU">
                    <input
                      id={`v-sku-${i}`}
                      value={variant.sku}
                      placeholder="optional"
                      onChange={(e) => patchVariant(i, { sku: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field id={`v-stock-${i}`} label="Stock">
                    <input
                      id={`v-stock-${i}`}
                      type="number"
                      min="0"
                      value={variant.stock}
                      onChange={(e) => patchVariant(i, { stock: e.target.value })}
                      className={inputCls}
                    />
                  </Field>
                  <Field id={`v-delta-${i}`} label="Price adjust">
                    <input
                      id={`v-delta-${i}`}
                      type="number"
                      step="0.01"
                      value={variant.priceDelta}
                      onChange={(e) =>
                        patchVariant(i, { priceDelta: e.target.value })
                      }
                      className={inputCls}
                    />
                  </Field>
                  <div className="flex items-center gap-1 pb-1">
                    <button
                      type="button"
                      className={btnGhostSm}
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
                      className={btnGhostSm}
                      disabled={i === 0}
                      aria-label={`Move ${variant.size || "row"} up`}
                      onClick={() => moveVariant(i, i - 1)}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className={btnGhostSm}
                      disabled={i === form.variants.length - 1}
                      aria-label={`Move ${variant.size || "row"} down`}
                      onClick={() => moveVariant(i, i + 1)}
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      className={btnGhostSm}
                      disabled={form.variants.length === 1}
                      aria-label={`Remove ${variant.size || "row"}`}
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          variants: f.variants.filter((_, j) => j !== i),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex gap-3">
                <button
                  type="button"
                  className={btnGhostSm}
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
                  className={btnGhostSm}
                  onClick={addColour}
                  title="Repeats the sizes above under a new colour"
                >
                  Add colour
                </button>
              </div>
              <p className="text-xs text-muted">
                Total stock:{" "}
                <span className="font-bold text-foreground">
                  {form.variants.reduce(
                    (sum, v) => sum + (Number(v.stock) || 0),
                    0,
                  )}
                </span>
              </p>
            </div>

            {namedColours(form.variants).length > 0 && (
              <div className="mt-5 border-t border-subtle pt-4">
                <p className={labelCls}>Photos per colour</p>
                <p className="mt-1 text-xs leading-6 text-muted">
                  A colour with its own photos shows those instead of the
                  product images below — not as well as them. Leave a colour
                  empty to use the product photos.
                </p>
                <div className="mt-3 flex flex-col gap-4">
                  {namedColours(form.variants).map((color) => {
                    const images =
                      form.variants.find((v) => v.color.trim() === color)
                        ?.images ?? [];
                    return (
                      <div key={color}>
                        <p className="text-[11px] font-medium uppercase tracking-[0.15em]">
                          {color}
                          <span className="ml-2 text-muted">
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
                                className="size-16 rounded-[2px] bg-surface object-cover"
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
                                className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[2px] bg-foreground text-[10px] font-bold text-background"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                          <label
                            className={`${btnOutline} h-16 w-16 cursor-pointer flex-col text-center text-[10px]`}
                          >
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
          </fieldset>


          <fieldset className="border border-subtle p-4">
            <legend className="px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
              Drop and pre-orders
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
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
              <div className="flex items-end pb-1">
                <p className="text-xs leading-6 text-muted">
                  Leave empty to publish as soon as the product is active.
                  Shoppers cannot see it before this moment even if it is.
                </p>
              </div>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.preorderEnabled}
                onChange={(e) =>
                  setForm({ ...form, preorderEnabled: e.target.checked })
                }
                className="size-4"
              />
              Take pre-orders once a size sells out
            </label>

            {form.preorderEnabled && (
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <Field id="p-pre-limit" label="Extra units per size">
                  <input
                    id="p-pre-limit"
                    type="number"
                    min="0"
                    value={form.preorderLimit}
                    onChange={(e) =>
                      setForm({ ...form, preorderLimit: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <Field id="p-pre-ships" label="Ships from">
                  <input
                    id="p-pre-ships"
                    type="date"
                    value={form.preorderShipsAt}
                    onChange={(e) =>
                      setForm({ ...form, preorderShipsAt: e.target.value })
                    }
                    className={inputCls}
                  />
                </Field>
                <p className="text-xs leading-6 text-muted sm:col-span-2">
                  0 extra units means no pre-orders — it never means unlimited.
                </p>
              </div>
            )}
          </fieldset>

          <div>
            <p className={labelCls}>Images</p>
            <p className="mt-1 text-xs text-muted">
              Describe each photo. Screen readers and Google both read it, and
              it is what shows if the image fails to load.
            </p>
            <div className="mt-2 flex flex-wrap gap-3">
              {form.images.map((url, index) => (
                <div key={`${url}-${index}`} className="relative w-40">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(url, 160)}
                    alt={form.imageAlts[index] || ""}
                    loading="lazy"
                    decoding="async"
                    className="size-20 rounded-[2px] bg-surface object-cover"
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
                    className="absolute left-[3.75rem] top-1 flex size-5 items-center justify-center rounded-[2px] bg-foreground text-[10px] font-bold text-background"
                  >
                    ×
                  </button>
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
                    className={`${inputCls} mt-1.5 text-[11px]`}
                  />
                </div>
              ))}
              <label
                className={`${btnOutline} h-20 w-20 cursor-pointer flex-col text-center`}
              >
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
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={busy || uploading}
              className={btnSolidSm}
            >
              {busy ? "Saving…" : editingId ? "Save changes" : "Create product"}
            </button>
            <button type="button" onClick={closeForm} className={btnGhostSm}>
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading && <Loading label="Loading products" />}
      {error && <ErrorNote message={error} />}
      {data && data.items.length === 0 && !loading && (
        <p className="py-8 text-sm text-muted">
          No products yet — hit “+ New product” to add the first one.
        </p>
      )}

      <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
        {data?.items.map((product) => (
          <li
            key={product.id}
            className="flex flex-col rounded-[2px] border border-subtle"
          >
            <div className="relative">
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl(product.images[0], 400)}
                  alt={product.name}
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full bg-surface object-cover"
                />
              ) : (
                <div className="flex aspect-square w-full items-center justify-center bg-surface">
                  <AsteriskMark className="size-8 text-subtle" />
                </div>
              )}
              {!product.isActive && (
                <span className="absolute left-0 top-0 w-full bg-foreground py-1 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-background">
                  Archived
                </span>
              )}
              {product.isActive && product.stock === 0 && (
                <span className="absolute left-0 top-0 w-full bg-foreground py-1 text-center text-[9px] font-bold uppercase tracking-[0.2em] text-background">
                  Sold out
                </span>
              )}
            </div>
            <div className="flex flex-1 flex-col gap-1 p-2.5">
              <p className="truncate text-[11px] font-bold uppercase tracking-wide">
                {product.name}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                {product.category ?? "—"} · {formatPrice(product.priceCents)}
              </p>
              <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-muted">
                {product.variants.some((v) => v.size || v.color)
                  ? product.variants
                      .map(
                        (v) =>
                          `${variantLabel(v.color, v.size) || "One size"} ${v.stock}${
                            v.isActive ? "" : " (retired)"
                          }`,
                      )
                      .join(" · ")
                  : `Stock ${product.stock}`}{" "}
                · ♥ {product.likeCount} · 💬 {product.commentCount}
              </p>
              <div className="mt-auto flex gap-3 pt-1.5">
                <button
                  type="button"
                  onClick={() => startEdit(product)}
                  className={btnGhostSm}
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
                  className={btnGhostSm}
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
                  className={btnGhostSm}
                >
                  Delete
                </button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      {pageCount > 1 && (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className={btnGhostSm}
          >
            ← Prev
          </button>
          <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
            {page} / {pageCount}
          </span>
          <button
            type="button"
            disabled={page >= pageCount}
            onClick={() => setPage((p) => p + 1)}
            className={btnGhostSm}
          >
            Next →
          </button>
        </div>
      )}
    </div>
  );
}
