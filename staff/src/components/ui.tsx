import { AsteriskMark } from "./asterisk-mark";

/* Shared class recipes — STIFF brutalist system, 8px grid, 5 interaction states. */

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground focus-visible:ring-offset-2 focus-visible:ring-offset-background";

export const btnSolid =
  `inline-flex min-h-11 items-center justify-center rounded-[2px] bg-foreground px-6 text-xs font-bold uppercase tracking-[0.2em] text-background transition-[opacity,transform] duration-150 ease-out hover:opacity-80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${focusRing}`;

export const btnSolidSm =
  `inline-flex min-h-11 items-center justify-center rounded-[2px] bg-foreground px-5 text-[11px] font-bold uppercase tracking-[0.15em] text-background transition-[opacity,transform] duration-150 ease-out hover:opacity-80 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100 ${focusRing}`;

export const btnOutline =
  `inline-flex min-h-11 items-center justify-center rounded-[2px] border border-subtle px-5 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors duration-150 hover:border-foreground hover:text-foreground active:bg-surface disabled:cursor-not-allowed disabled:opacity-40 ${focusRing}`;

export const btnGhostSm =
  `inline-flex min-h-11 items-center rounded-[2px] px-2 text-[11px] font-medium uppercase tracking-[0.15em] text-muted transition-colors duration-150 hover:text-foreground ${focusRing}`;

export const inputCls =
  `h-12 w-full rounded-[2px] border border-subtle bg-transparent px-4 text-base text-foreground placeholder:text-muted/70 transition-colors duration-150 focus:border-foreground md:text-sm ${focusRing}`;

export const textareaCls =
  `w-full rounded-[2px] border border-subtle bg-transparent px-4 py-3 text-base leading-6 text-foreground placeholder:text-muted/70 transition-colors duration-150 focus:border-foreground md:text-sm ${focusRing}`;

export const selectCls =
  `h-11 w-full min-w-0 rounded-[2px] border border-subtle bg-background px-3 text-[11px] font-medium uppercase tracking-[0.15em] text-foreground transition-colors duration-150 focus:border-foreground ${focusRing}`;

export const labelCls =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-muted";

export const eyebrowCls =
  "text-[11px] font-medium uppercase tracking-[0.2em] text-muted";

export const pagePad = "px-4 sm:px-6 lg:px-8";

export function chipCls(active: boolean): string {
  return `inline-flex min-h-11 items-center rounded-[2px] px-4 text-[11px] font-medium uppercase tracking-[0.15em] transition-colors duration-150 ${focusRing} ${
    active
      ? "bg-foreground text-background"
      : "border border-subtle text-muted hover:border-foreground hover:text-foreground"
  }`;
}

export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <AsteriskMark className={`animate-asterisk-tick text-muted ${className}`} />
  );
}

export function Loading({ label = "Loading" }: { label?: string }) {
  return (
    <div className={`flex items-center gap-3 py-16 text-muted ${pagePad}`} role="status">
      <Spinner className="size-5" />
      <span className="text-[11px] font-medium uppercase tracking-[0.2em]">
        {label}
      </span>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={`animate-pulse rounded-[2px] bg-surface ${className ?? ""}`}
    />
  );
}

export function ErrorNote({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className={`${pagePad} my-8 flex flex-col gap-4 border-l-2 border-foreground py-2 pl-4`}
    >
      <p className="text-sm leading-6 text-foreground">{message}</p>
      {onRetry && (
        <button type="button" className={btnOutline} onClick={onRetry}>
          Try again
        </button>
      )}
    </div>
  );
}

export function Banner({
  message,
  tone = "muted",
}: {
  message: string;
  tone?: "muted" | "error";
}) {
  if (!message) return null;
  return (
    <p
      role="alert"
      aria-live="polite"
      className={`text-sm leading-6 ${tone === "error" ? "text-foreground" : "text-muted"}`}
    >
      {message}
    </p>
  );
}

export function Field({
  id,
  label,
  children,
  hint,
  error,
  optional,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
  hint?: string;
  error?: string;
  optional?: boolean;
}) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelCls}>
        {label}
        {optional && (
          <span className="ml-2 font-normal normal-case tracking-normal text-muted">
            optional
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-xs leading-5 text-foreground">
          {error}
        </p>
      ) : hint ? (
        <p id={hintId} className="text-xs leading-5 text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
}) {
  return (
    <header className={`flex flex-col gap-4 border-b border-subtle py-5 sm:py-6 lg:flex-row lg:items-end lg:justify-between lg:py-8 ${pagePad}`}>
      <div className="min-w-0">
        <p className={eyebrowCls}>{eyebrow}</p>
        <h1 className="mt-1 text-2xl uppercase leading-none tracking-tight sm:text-3xl lg:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className={`flex flex-col items-start gap-4 py-16 ${pagePad}`}>
      <AsteriskMark className="size-6 text-muted" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="mt-2 max-w-sm text-sm leading-6 text-muted">{body}</p>
      </div>
      {action}
    </div>
  );
}

export function Avatar({
  name,
  size = "md",
}: {
  name: string;
  size?: "sm" | "md" | "lg";
}) {
  const initial = (name.trim()[0] ?? "?").toUpperCase();
  const box =
    size === "sm" ? "size-8 text-[11px]" : size === "lg" ? "size-12 text-base" : "size-10 text-sm";
  return (
    <span
      aria-hidden
      className={`inline-flex shrink-0 items-center justify-center rounded-[2px] bg-surface font-medium uppercase ${box}`}
    >
      {initial}
    </span>
  );
}

export function SearchInput({
  id,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative">
      <label htmlFor={id} className="sr-only">
        {placeholder}
      </label>
      <input
        id={id}
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={inputCls}
      />
    </div>
  );
}
