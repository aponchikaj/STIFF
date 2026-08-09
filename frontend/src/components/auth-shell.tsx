import Link from "next/link";

export function AuthShell({
  title,
  children,
  footer,
}: {
  title: string;
  children: React.ReactNode;
  footer?: { label: string; href: string; text: string }[];
}) {
  return (
    <section className="mx-auto w-full max-w-sm flex-1 px-4 py-16 sm:py-24">
      <h1 className="text-4xl uppercase tracking-tight sm:text-5xl">{title}</h1>
      <div className="mt-10">{children}</div>
      {footer && footer.length > 0 && (
        <div className="mt-8 flex flex-col gap-2 border-t border-subtle pt-6">
          {footer.map(({ label, href, text }) => (
            <p key={href} className="text-xs text-muted">
              {text}{" "}
              <Link
                href={href}
                className="rounded-[2px] font-medium uppercase tracking-[0.1em] text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                {label}
              </Link>
            </p>
          ))}
        </div>
      )}
    </section>
  );
}
