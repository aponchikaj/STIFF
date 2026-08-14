"use client";

import { useEffect, useRef, useState } from "react";
import { adminApi } from "@/lib/api";
import type { CollabCodeRow } from "@/lib/api";
import { formatDate } from "@/lib/format";
import { errorMessage } from "@/lib/hooks";
import { btnGhostSm, btnOutline, btnSolidSm, inputCls, labelCls } from "../ui";

const STATUS: Record<CollabCodeRow["status"], string> = {
  unused: "Ready",
  claimed: "Opened",
  revoked: "Revoked",
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
      className={`flex flex-col border p-4 ${
        code.status === "revoked"
          ? "border-subtle opacity-70"
          : "border-foreground/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-2xl tracking-tight tabular-nums">
            {code.serial}
          </p>
          {code.label ? (
            <p className="mt-1 text-sm text-foreground">{code.label}</p>
          ) : (
            <p className="mt-1 text-sm text-muted">No label</p>
          )}
        </div>
        <span
          className={`flex h-7 items-center rounded-[2px] px-2.5 text-[10px] font-bold uppercase tracking-[0.15em] ${
            code.status === "unused"
              ? "bg-foreground text-background"
              : code.status === "claimed"
                ? "border border-foreground text-foreground"
                : "border border-subtle text-muted"
          }`}
        >
          {STATUS[code.status]}
        </span>
      </div>
      <p className="mt-3 text-[11px] uppercase tracking-[0.15em] text-muted">
        {code.claimedAt
          ? `Opened ${formatDate(code.claimedAt)}`
          : `Minted ${formatDate(code.createdAt)}`}
      </p>

      <div className="mt-4 flex flex-col gap-2">
        {printable && (
          <button
            type="button"
            disabled={locked || downloading}
            onClick={() => void download()}
            className={btnSolidSm}
          >
            {downloading ? "Downloading…" : "Download QR image"}
          </button>
        )}
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={locked}
            onClick={() => setOpen((value) => !value)}
            className={btnOutline}
          >
            {open ? "Hide settings" : "Settings"}
          </button>
          <button
            type="button"
            disabled={locked}
            onClick={() => void remove()}
            className={btnOutline}
          >
            Delete
          </button>
        </div>
      </div>

      {open && (
        <div className="mt-4 flex flex-col gap-4 border-t border-subtle pt-4">
          {printable && (
            <div className="flex items-start gap-4">
              <div className="flex size-28 shrink-0 items-center justify-center border border-subtle bg-white">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={preview}
                    alt={`QR for pair ${code.serial}`}
                    className="size-full object-contain p-1"
                  />
                ) : (
                  <span className="px-2 text-center text-[10px] uppercase tracking-[0.15em] text-muted">
                    {previewBusy ? "Loading" : "QR"}
                  </span>
                )}
              </div>
              <p className="text-sm leading-6 text-muted">
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
                  className="break-all text-sm leading-6 text-foreground underline decoration-subtle underline-offset-4 hover:decoration-foreground"
                >
                  {scanUrl}
                </a>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => void copyLink()}
                    className={btnOutline}
                  >
                    {copied ? "Copied" : "Copy link"}
                  </button>
                  <a
                    href={scanUrl}
                    target="_blank"
                    rel="noreferrer"
                    className={btnOutline}
                  >
                    Open
                  </a>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Loading link…</p>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor={`label-${code.id}`} className={labelCls}>
              Label
            </label>
            <input
              id={`label-${code.id}`}
              value={label}
              maxLength={80}
              placeholder="e.g. black frame · left temple"
              onChange={(event) => setLabel(event.target.value)}
              className={inputCls}
            />
            <button
              type="button"
              disabled={locked || saving || !dirty}
              onClick={() => void saveLabel()}
              className={btnOutline}
            >
              {saving ? "Saving…" : "Save label"}
            </button>
          </div>

          <div className="flex flex-wrap gap-4">
            {code.status !== "unused" && (
              <button
                type="button"
                disabled={locked}
                onClick={() => void reset()}
                className={btnGhostSm}
              >
                Reset scan
              </button>
            )}
            {printable && (
              <button
                type="button"
                disabled={locked}
                onClick={() => void regenerate()}
                className={btnGhostSm}
              >
                New QR
              </button>
            )}
            {code.status !== "revoked" && (
              <button
                type="button"
                disabled={locked}
                onClick={() => void revoke()}
                className={btnGhostSm}
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
