"use client";

import { useRef, useState } from "react";
import { adminApi, productsApi } from "@/lib/api";
import type { Product } from "@/lib/api";
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

const EMPTY = {
  name: "",
  category: "",
  price: "",
  stock: "",
  sizes: "S, M, L, XL",
  stockBySize: {} as Record<string, string>,
  description: "",
  images: [] as string[],
};

function parseSizes(value: string): string[] {
  return value
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
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
      stock: String(product.stock),
      sizes: product.sizes.join(", "),
      stockBySize: Object.fromEntries(
        product.sizes.map((size) => [
          size,
          String(
            product.stockBySize?.[size] ??
              (size === product.sizes[0] ? product.stock : 0),
          ),
        ]),
      ),
      description: product.description,
      images: product.images,
    });
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
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
        setForm((f) => ({ ...f, images: [...f.images, url] }));
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
    const sizes = parseSizes(form.sizes);
    const payload = {
      name: form.name,
      category: form.category || undefined,
      priceCents: Math.round(Number(form.price) * 100),
      sizes,
      stockBySize:
        sizes.length > 0
          ? Object.fromEntries(
              sizes.map((size) => [
                size,
                Number(form.stockBySize[size]) || 0,
              ]),
            )
          : undefined,
      stock: sizes.length > 0 ? undefined : Number(form.stock) || 0,
      description: form.description || undefined,
      images: form.images,
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
            {parseSizes(form.sizes).length === 0 && (
              <Field id="p-stock" label="Stock">
                <input
                  id="p-stock"
                  required
                  type="number"
                  min="0"
                  value={form.stock}
                  onChange={(e) => setForm({ ...form, stock: e.target.value })}
                  className={inputCls}
                />
              </Field>
            )}
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Field id="p-sizes" label="Sizes (comma separated)">
              <input
                id="p-sizes"
                value={form.sizes}
                onChange={(e) => setForm({ ...form, sizes: e.target.value })}
                className={inputCls}
              />
            </Field>
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

          {parseSizes(form.sizes).length > 0 && (
            <div>
              <p className={labelCls}>Qty per size</p>
              <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {parseSizes(form.sizes).map((size) => (
                  <Field key={size} id={`p-stock-${size}`} label={size}>
                    <input
                      id={`p-stock-${size}`}
                      type="number"
                      min="0"
                      value={form.stockBySize[size] ?? "0"}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          stockBySize: {
                            ...form.stockBySize,
                            [size]: e.target.value,
                          },
                        })
                      }
                      className={inputCls}
                    />
                  </Field>
                ))}
              </div>
            </div>
          )}

          <div>
            <p className={labelCls}>Images</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {form.images.map((url) => (
                <div key={url} className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={imageUrl(url, 160)}
                    alt=""
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
                        images: f.images.filter((u) => u !== url),
                      }))
                    }
                    className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[2px] bg-foreground text-[10px] font-bold text-background"
                  >
                    ×
                  </button>
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
                {product.sizes.length > 0
                  ? product.sizes
                      .map(
                        (size) =>
                          `${size} ${product.stockBySize?.[size] ?? 0}`,
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
