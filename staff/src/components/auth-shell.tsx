import Link from "next/link";
import { AsteriskMark } from "@/components/asterisk-mark";

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
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-12 sm:px-6 sm:py-20">
      <div className="flex items-center gap-3">
        <AsteriskMark className="size-7 sm:size-8" />
        <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted">
          Staff
        </p>
      </div>
      <h1 className="mt-6 text-4xl uppercase leading-none tracking-tight sm:text-5xl">
        {title}
      </h1>
      <div className="mt-8 sm:mt-10">{children}</div>
      {footer && footer.length > 0 && (
        <div className="mt-8 flex flex-col gap-2 border-t border-subtle pt-6">
          {footer.map(({ label, href, text }) => (
            <p key={href} className="text-sm leading-6 text-muted">
              {text}{" "}
              <Link
                href={href}
                className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground"
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
