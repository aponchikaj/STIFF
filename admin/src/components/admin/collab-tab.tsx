"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { adminApi, resolveApiUrl } from "@/lib/api";
import type { CollabCodeRow, CollabCodeStatus, CollabOverview } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { CollabCodeCard } from "./collab-code-card";
import {
  btnOutline,
  btnSolidSm,
  chipCls,
  Field,
  inputCls,
  labelCls,
  Loading,
} from "../ui";

const FILTERS: { id: "all" | CollabCodeStatus; label: string }[] = [
  { id: "all", label: "All" },
  { id: "unused", label: "Unused" },
  { id: "claimed", label: "Opened" },
  { id: "revoked", label: "Revoked" },
];

export function CollabTab() {
  const [overview, setOverview] = useState<CollabOverview | null>(null);
  const [codes, setCodes] = useState<CollabCodeRow[]>([]);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState<"all" | CollabCodeStatus>("all");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [countInput, setCountInput] = useState("1");
  const [titleInput, setTitleInput] = useState("");
  const [capInput, setCapInput] = useState("300");
  const [query, setQuery] = useState("");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(
    async (
      status: "all" | CollabCodeStatus,
      opts?: { keepNote?: boolean },
    ) => {
      setLoading(true);
      if (!opts?.keepNote) setNote(null);
      try {
        const nextOverview = await adminApi.getCollab();
        const pageSize = 300;
        const first = await adminApi.listCollabCodes({
          page: 1,
          pageSize,
          status: status === "all" ? undefined : status,
        });
        const items = [...first.items];
        const pages = Math.max(1, Math.ceil(first.total / pageSize));
        for (let page = 2; page <= pages; page += 1) {
          const next = await adminApi.listCollabCodes({
            page,
            pageSize,
            status: status === "all" ? undefined : status,
          });
          items.push(...next.items);
        }
        setOverview(nextOverview);
        setTitleInput(nextOverview.title);
        setCapInput(String(nextOverview.maxCodes));
        setCodes(items);
        setTotal(first.total);
      } catch (err) {
        setNote(errorMessage(err));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void load(filter);
  }, [filter, load]);

  const remaining = overview
    ? Math.max(0, overview.maxCodes - (overview.unused + overview.claimed))
    : 0;

  async function generate() {
    const count = Number.parseInt(countInput, 10);
    if (!Number.isInteger(count) || count < 1) {
      setNote("Enter how many QR codes to mint — a whole number, at least 1.");
      return;
    }
    setBusy("generate");
    setNote(null);
    try {
      const result = await adminApi.generateCollabCodes(count);
      setNote(
        `Minted ${result.created} code${result.created === 1 ? "" : "s"}. Download the PNG on each card — that file is the QR, nothing else.`,
      );
      await load(filter, { keepNote: true });
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings(patch: {
    title?: string;
    maxCodes?: number;
    strictMode?: boolean;
  }) {
    setBusy("settings");
    setNote(null);
    try {
      const next = await adminApi.updateCollab(patch);
      setOverview(next);
      setTitleInput(next.title);
      setCapInput(String(next.maxCodes));
      setNote(
        patch.strictMode === true
          ? "Strict is ON — one scan, no screening, not shareable."
          : patch.strictMode === false
            ? "Strict is OFF — codes can be scanned again and screening is allowed."
            : "Drop settings saved.",
      );
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function downloadZip() {
    setBusy("zip");
    setNote(null);
    try {
      await adminApi.downloadCollabQrZip();
      setNote("QR images downloaded — PNG files only.");
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function onVideo(file: File | undefined) {
    if (!file) return;
    setBusy("video");
    setNote(null);
    setPreviewUrl(null);
    try {
      await adminApi.uploadCollabVideo(file);
      setNote("Film uploaded. Codes will play this file.");
      await load(filter);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  async function removeVideo() {
    if (
      !confirm(
        "Remove the collab film? Scans will wait until you upload again.",
      )
    ) {
      return;
    }
    setBusy("unvideo");
    setNote(null);
    setPreviewUrl(null);
    try {
      await adminApi.deleteCollabVideo();
      await load(filter);
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  async function preview() {
    setBusy("preview");
    setNote(null);
    try {
      const play = await adminApi.previewCollabVideo();
      setPreviewUrl(
        play.mode === "proxy" ? resolveApiUrl(play.url) : play.url,
      );
    } catch (err) {
      setNote(errorMessage(err));
    } finally {
      setBusy(null);
    }
  }

  function onCodeChanged(next: CollabCodeRow | "reload") {
    if (next === "reload") {
      void load(filter);
      return;
    }
    setCodes((rows) => rows.map((row) => (row.id === next.id ? next : row)));
  }

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return codes;
    return codes.filter(
      (code) =>
        code.serial.toLowerCase().includes(needle) ||
        (code.label ?? "").toLowerCase().includes(needle),
    );
  }, [codes, query]);

  const printable = overview
    ? overview.unused + overview.claimed
    : 0;

  if (loading && !overview) return <Loading label="Loading collab" />;
  if (!overview) {
    return (
      <p className="text-sm text-muted">{note ?? "Could not load the collab."}</p>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="border border-foreground p-5 sm:p-7">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-xl">
            <p className={labelCls}>Drop</p>
            <h2 className="mt-2 font-display text-3xl uppercase tracking-tight sm:text-5xl">
              {overview.title}
            </h2>
            <p className="mt-3 text-sm leading-6 text-muted">
              {overview.strictMode
                ? "Strict is on. Each QR opens once, on the phone that scanned it. Screening is blocked as far as the browser allows, and a forwarded link is dead."
                : "Strict is off. The same QR can be scanned again. Screening and sharing are allowed. A code is still required to reach the film."}
            </p>
          </div>
          <div>
            <p className={`${labelCls} mb-2`}>Strict mode</p>
            <div className="flex gap-1.5">
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void saveSettings({ strictMode: true })}
                className={`flex h-11 items-center rounded-[2px] px-5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                  overview.strictMode
                    ? "bg-foreground text-background"
                    : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                On
              </button>
              <button
                type="button"
                disabled={busy !== null}
                onClick={() => void saveSettings({ strictMode: false })}
                className={`flex h-11 items-center rounded-[2px] px-5 text-[11px] font-bold uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
                  !overview.strictMode
                    ? "bg-foreground text-background"
                    : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
                }`}
              >
                Off
              </button>
            </div>
          </div>
        </div>
        <dl className="mt-8 grid grid-cols-2 gap-px bg-subtle sm:grid-cols-4">
          <Stat label="Unused" value={overview.unused} />
          <Stat label="Opened" value={overview.claimed} />
          <Stat label="Revoked" value={overview.revoked} />
          <Stat label="Left to mint" value={remaining} />
        </dl>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="border border-subtle p-5">
          <p className={labelCls}>Film</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            {overview.hasVideo
              ? `On file${overview.videoUploadedAt ? ` · ${formatDate(overview.videoUploadedAt)}` : ""}. Replace anytime — codes already minted stay valid.`
              : "Nothing uploaded. A scan will not burn a code until a film is here."}
          </p>
          <input
            ref={fileInput}
            type="file"
            accept="video/mp4,video/webm,video/quicktime"
            className="sr-only"
            onChange={(event) => void onVideo(event.target.files?.[0])}
          />
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => fileInput.current?.click()}
              className={btnSolidSm}
            >
              {busy === "video"
                ? "Uploading…"
                : overview.hasVideo
                  ? "Replace film"
                  : "Upload film"}
            </button>
            {overview.hasVideo && (
              <>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void preview()}
                  className={btnOutline}
                >
                  {busy === "preview" ? "Loading…" : "Preview"}
                </button>
                <button
                  type="button"
                  disabled={busy !== null}
                  onClick={() => void removeVideo()}
                  className={btnOutline}
                >
                  Remove
                </button>
              </>
            )}
          </div>
          {previewUrl && (
            <video
              src={previewUrl}
              controls
              playsInline
              className="mt-5 aspect-video w-full bg-black object-contain"
            />
          )}
        </section>

        <section className="border border-subtle p-5">
          <p className={labelCls}>Mint QR codes</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Type how many you need. Cap is {overview.maxCodes} · {remaining}{" "}
            still free. Each card below has its own PNG download. “Download all”
            is a zip of those same images — no CSV, no links.
          </p>
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field id="qr-count" label="How many">
              <input
                id="qr-count"
                type="number"
                inputMode="numeric"
                min={1}
                max={remaining || overview.maxCodes}
                value={countInput}
                onChange={(event) => setCountInput(event.target.value)}
                className={`${inputCls} tabular-nums sm:w-32`}
              />
            </Field>
            <button
              type="button"
              disabled={busy !== null || remaining === 0}
              onClick={() => void generate()}
              className={btnSolidSm}
            >
              {busy === "generate" ? "Minting…" : "Generate"}
            </button>
          </div>
          <button
            type="button"
            disabled={busy !== null || printable === 0}
            onClick={() => void downloadZip()}
            className={`${btnSolidSm} mt-4 w-full sm:w-auto`}
          >
            {busy === "zip"
              ? "Building pack…"
              : `Download all QR codes${printable > 0 ? ` · ${printable}` : ""}`}
          </button>
        </section>
      </div>

      <section className="border border-subtle p-5">
        <p className={labelCls}>Drop settings</p>
        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <Field id="collab-title" label="Title">
            <input
              id="collab-title"
              value={titleInput}
              onChange={(event) => setTitleInput(event.target.value)}
              className={inputCls}
            />
          </Field>
          <Field id="collab-cap" label="Cap">
            <input
              id="collab-cap"
              type="number"
              inputMode="numeric"
              min={overview.unused + overview.claimed}
              max={2000}
              value={capInput}
              onChange={(event) => setCapInput(event.target.value)}
              className={`${inputCls} tabular-nums`}
            />
          </Field>
        </div>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => {
            const maxCodes = Number.parseInt(capInput, 10);
            if (!Number.isInteger(maxCodes) || maxCodes < 1) {
              setNote("Cap must be a whole number, at least 1.");
              return;
            }
            void saveSettings({
              title: titleInput.trim() || overview.title,
              maxCodes,
            });
          }}
          className={`${btnSolidSm} mt-5`}
        >
          {busy === "settings" ? "Saving…" : "Save settings"}
        </button>
        <p className="mt-4 text-[11px] uppercase tracking-[0.15em] text-muted">
          QR target · {overview.qrBaseUrl}/c/{overview.slug}/…
        </p>
      </section>

      {note && (
        <p
          role="status"
          className="border border-foreground px-4 py-3 text-sm leading-6"
        >
          {note}
        </p>
      )}

      <section>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className={labelCls}>QR codes</p>
            <p className="mt-2 text-sm text-muted">
              Each pair is a card. Download the QR image from the card, or open
              settings to label, reset, replace, revoke, or delete it.
            </p>
          </div>
          <Field id="qr-search" label="Find">
            <input
              id="qr-search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Serial or label"
              className={`${inputCls} sm:w-56`}
            />
          </Field>
        </div>
        <div className="-mx-4 mt-5 flex gap-1.5 overflow-x-auto px-4 pb-2 sm:mx-0 sm:px-0">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setFilter(item.id)}
              className={`${chipCls(filter === item.id)} shrink-0`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {loading ? (
          <Loading label="Loading codes" />
        ) : codes.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No codes in this filter.</p>
        ) : visible.length === 0 ? (
          <p className="mt-6 text-sm text-muted">No codes match that search.</p>
        ) : (
          <>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((code) => (
                <CollabCodeCard
                  key={code.id}
                  code={code}
                  busy={busy !== null}
                  onChanged={onCodeChanged}
                  onError={(message) => setNote(message)}
                />
              ))}
            </div>
            <p className="mt-4 text-[11px] uppercase tracking-[0.15em] text-muted">
              {visible.length}
              {visible.length !== total ? ` of ${total}` : ""} shown
            </p>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-background px-4 py-5 sm:px-5">
      <dt className="text-[11px] uppercase tracking-[0.15em] text-muted">
        {label}
      </dt>
      <dd className="mt-2 font-display text-3xl tracking-tight tabular-nums">
        {value}
      </dd>
    </div>
  );
}
