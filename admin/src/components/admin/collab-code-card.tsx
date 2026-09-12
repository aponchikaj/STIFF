"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import type { CollabCodeRow } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import {
  Badge,
  btnDanger,
  btnGhost,
  btnPrimarySm,
  btnSecondarySm,
  Field,
  inputCls,
  labelCls,
  type Tone,
} from "../ui";

const STATUS: Record<CollabCodeRow["status"], string> = {
  unused: "Ready",
  claimed: "Opened",
  revoked: "Revoked",
};

/** Colour is the state, never decoration: minted, opened, dead. */
const STATUS_TONE: Record<CollabCodeRow["status"], Tone> = {
  unused: "neutral",
  claimed: "positive",
  revoked: "danger",
};

export function CollabCodeCard({
  code,
  busy,
  onChanged,
  onError,
}: {
  code: CollabCodeRow;
  busy: boolean;
  onChanged: (next: CollabCodeRow | "reload") => void;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(code.label ?? "");
  const [preview, setPreview] = useState<string | null>(null);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [scanUrl, setScanUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [acting, setActing] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);
  const onErrorRef = useRef(onError);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    setLabel(code.label ?? "");
  }, [code.label]);

  const printable = code.status !== "revoked";
  const locked = busy || acting;

  useEffect(() => {
    if (!open) {
      setPreview(null);
      setScanUrl(null);
      setCopied(false);
      return;
    }
    let cancelled = false;
    let objectUrl: string | null = null;
    setPreviewBusy(true);
    void adminApi
      .getCollabCodeAccess(code.id)
      .then((access) => {
        if (!cancelled) {
          setScanUrl(`${window.location.origin}${access.path}`);
        }
      })
      .catch((err) => {
        if (!cancelled) onErrorRef.current(errorMessage(err));
      });
    if (printable) {
      void adminApi
        .fetchCollabQrBlob(code.id)
        .then((blob) => {
          if (cancelled) return;
          objectUrl = URL.createObjectURL(blob);
          setPreview(objectUrl);
        })
        .catch((err) => {
          if (!cancelled) onErrorRef.current(errorMessage(err));
        })
        .finally(() => {
          if (!cancelled) setPreviewBusy(false);
        });
    } else {
      setPreviewBusy(false);
    }
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [open, code.id, printable, previewEpoch]);

  async function saveLabel() {
    setSaving(true);
    try {
      const next = await adminApi.updateCollabCode(code.id, {
        label: label.trim(),
      });
      onChanged(next);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await adminApi.downloadCollabQr(code.id, code.serial);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setDownloading(false);
    }
  }

  async function revoke() {
    if (!confirm(`Revoke pair ${code.serial}? Its QR will stop working.`)) {
      return;
    }
    setActing(true);
    try {
      await adminApi.revokeCollabCode(code.id);
      onChanged("reload");
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setActing(false);
    }
  }

  async function reset() {
    if (!confirm(`Reset pair ${code.serial} so this QR can be scanned again?`)) {
      return;
    }
    setActing(true);
    try {
      await adminApi.resetCollabCode(code.id);
      onChanged("reload");
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setActing(false);
    }
  }

  async function regenerate() {
    if (
      !confirm(
        `Replace the QR for pair ${code.serial}? The old scan dies. Download the new PNG after.`,
      )
    ) {
      return;
    }
    setActing(true);
    try {
      const next = await adminApi.regenerateCollabCode(code.id);
      setPreviewEpoch((value) => value + 1);
      setCopied(false);
      onChanged(next);
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setActing(false);
    }
  }

  async function remove() {
    if (
      !confirm(
        `Delete pair ${code.serial}? This cannot be undone. You can mint another.`,
      )
    ) {
      return;
    }
    setActing(true);
    try {
      await adminApi.deleteCollabCode(code.id);
      onChanged("reload");
    } catch (err) {
      onError(errorMessage(err));
    } finally {
      setActing(false);
    }
  }

  async function copyLink() {
    if (!scanUrl) return;
    try {
      await navigator.clipboard.writeText(scanUrl);
      setCopied(true);
    } catch {
      onError("Could not copy — your browser blocked clipboard access.");
    }
  }

  const dirty = label.trim() !== (code.label ?? "").trim();

  return (
    <article
      className={`flex flex-col rounded-[var(--radius-control)] border border-line p-4 ${
        code.status === "revoked" ? "opacity-70" : ""
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display tnum text-[22px] leading-none">
            {code.serial}
          </p>
          <p
            className={`mt-1.5 truncate text-[13px] ${
              code.label ? "text-ink" : "text-faint"
            }`}
          >
            {code.label || "No label"}
          </p>
        </div>
        <Badge tone={STATUS_TONE[code.status]}>{STATUS[code.status]}</Badge>
      </div>
      <p className="mt-2 text-[11px] leading-5 text-faint">
        {code.claimedAt
          ? `Opened ${formatDate(code.claimedAt)}`
          : `Minted ${formatDate(code.createdAt)}`}
      </p>

      <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          disabled={locked}
          onClick={() => setOpen((value) => !value)}
          className={btnSecondarySm}
        >
          {open ? "Hide settings" : "Settings"}
        </button>
        <button
          type="button"
          disabled={locked}
          onClick={() => void remove()}
          className={btnDanger}
        >
          Delete
        </button>
        {printable && (
          <button
            type="button"
            disabled={locked || downloading}
            onClick={() => void download()}
            className={btnPrimarySm}
          >
            {downloading ? "Downloading…" : "Download QR image"}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-line pt-4">
          {printable && (
            <div className="flex items-start gap-4">
              <div className="flex size-28 shrink-0 items-center justify-center rounded-[var(--radius-control)] border border-line bg-white">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={`QR for pair ${code.serial}`}
                    className="size-full object-contain p-1"
                  />
                ) : (
                  <span className="px-2 text-center text-[10px] font-bold uppercase tracking-[0.1em] text-faint">
                    {previewBusy ? "Loading" : "QR"}
                  </span>
                )}
              </div>
              <p className="text-[13px] leading-6 text-muted">
                Download is a PNG of this square. Print it on pair {code.serial}
                {code.label ? ` · ${code.label}` : ""}.
              </p>
            </div>
          )}

          <div className="flex flex-col gap-2">
            <p className={labelCls}>Scan link</p>
            {scanUrl ? (
              <>
                <a
                  href={scanUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="break-all text-[13px] leading-6 text-ink underline decoration-line underline-offset-4 hover:decoration-ink"
                >
                  {scanUrl}
                </a>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void copyLink()}
                    className={btnSecondarySm}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={scanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={btnSecondarySm}
                  >
                    Open
                  </a>
                </div>
              </>
            ) : (
              <p className="text-[13px] text-muted">Loading link…</p>
            )}
          </div>

          <Field id={`label-${code.id}`} label="Label">
            <input
              id={`label-${code.id}`}
              value={label}
              maxLength={80}
              placeholder="e.g. black frame · left temple"
              onChange={(event) => setLabel(event.target.value)}
              className={inputCls}
            />
          </Field>
          <div>
            <button
              type="button"
              disabled={locked || saving || !dirty}
              onClick={() => void saveLabel()}
              className={btnSecondarySm}
            >
              {saving ? "Saving…" : "Save label"}
            </button>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-4 border-t border-line pt-4">
            {code.status !== "unused" && (
              <button
                type="button"
                disabled={locked}
                onClick={() => void reset()}
                className={btnGhost}
              >
                Reset scan
              </button>
            )}
            {printable && (
              <button
                type="button"
                disabled={locked}
                onClick={() => void regenerate()}
                className={btnGhost}
              >
                New QR
              </button>
            )}
            {code.status !== "revoked" && (
              <button
                type="button"
                disabled={locked}
                onClick={() => void revoke()}
                className={`${btnGhost} text-danger hover:text-danger`}
              >
                Revoke
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}
