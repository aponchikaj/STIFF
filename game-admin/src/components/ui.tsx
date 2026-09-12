import { AsteriskMark } from "./asterisk-mark";

/* Shared class recipes — the brutalist design system in one place. */

export const btnSolid =
  "flex h-12 items-center justify-center rounded-[2px] bg-foreground px-8 text-xs font-bold uppercase tracking-[0.2em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-40";

export const btnSolidSm =
  "flex h-10 items-center justify-center rounded-[2px] bg-foreground px-5 text-[11px] font-bold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-not-allowed disabled:opacity-40";

export const btnOutline =
  "flex h-10 items-center justify-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-not-allowed disabled:opacity-40";

export const btnGhostSm =
  "rounded-[2px] text-[11px] font-medium uppercase tracking-[0.15em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted disabled:cursor-not-allowed disabled:opacity-40";

export const inputCls =
  "h-12 w-full rounded-[2px] border border-subtle bg-transparent px-4 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-foreground focus-visible:outline-none";

export const textareaCls =
  "w-full rounded-[2px] border border-subtle bg-transparent px-4 py-3 text-sm text-foreground placeholder:text-muted/60 transition-colors focus:border-foreground focus-visible:outline-none";

export const selectCls =
  "h-10 rounded-[2px] border border-subtle bg-background px-3 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground transition-colors focus:border-foreground focus-visible:outline-none";

export const labelCls =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-muted";

export const eyebrowCls =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-muted";

export function chipCls(active: boolean): string {
  return `flex h-9 items-center rounded-[2px] px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted ${
    active
      ? "bg-foreground text-background"
      : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
  }`;
}

/** The asterisk is the loader — it ticks arm by arm rather than spinning. */
export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <AsteriskMark className={`animate-asterisk-tick text-muted ${className}`} />
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 py-16 text-muted">
      <Spinner className="size-5" />
      <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
        {label}
      </span>
    </div>
  );
}

export function ErrorNote({ message }: { message: string }) {
  return (
    <p role="alert" className="py-8 text-xs leading-6 text-muted">
      {message}
    </p>
  );
}

export function Field({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelCls}>
        {label}
      </label>
      {children}
    </div>
  );
}
