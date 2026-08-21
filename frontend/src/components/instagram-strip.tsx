import Link from "next/link";
import type { InstagramStrip as Strip } from "@/lib/api";
import { Reveal } from "./motion";

/**
 * The last six posts.
 *
 * The brand lives on Instagram and the site has never shown it, which makes
 * the site look like the quiet one. Rendered on the server from a cached
 * backend response, so a slow afternoon at Instagram costs the home page
 * nothing.
 *
 * With no token configured this is still worth rendering — as a link out. A
 * strip that vanishes entirely is indistinguishable from one that broke.
 */

const HANDLE = "stiff__________";
const PROFILE = `https://www.instagram.com/${HANDLE}/`;

const linkCls =
  "rounded-[2px] text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted";

export function InstagramStrip({
  strip,
  eyebrow,
}: {
  strip: Strip;
  eyebrow: string;
}) {
  const posts = strip.posts.slice(0, 6);

  return (
    <section
      aria-label="Latest from Instagram"
      className="w-full border-t border-subtle px-4 py-16 sm:px-6 sm:py-20"
    >
      <Reveal className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
        <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted">
          {eyebrow}
        </p>
        <a
          href={PROFILE}
          target="_blank"
          rel="noopener noreferrer"
          className={linkCls}
        >
          @{HANDLE} →
        </a>
      </Reveal>

      {posts.length > 0 ? (
        <ul className="mt-8 grid grid-cols-3 gap-2 sm:grid-cols-6 sm:gap-3">
          {posts.map((post) => (
            <li key={post.id}>
              <a
                href={post.permalink}
                target="_blank"
                rel="noopener noreferrer"
                className="group relative block overflow-hidden rounded-[2px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
              >
                {/* Instagram's CDN, not ours — `next/image` cannot optimise a
                    host it is not configured for, and these already arrive at
                    a sensible size. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={post.imageUrl}
                  alt={
                    post.caption
                      ? `Instagram post: ${post.caption.slice(0, 120)}`
                      : "Instagram post"
                  }
                  loading="lazy"
                  decoding="async"
                  className="aspect-square w-full bg-surface object-cover transition-opacity group-hover:opacity-85"
                />
                {post.isVideo && (
                  <span
                    aria-hidden="true"
                    className="absolute right-1.5 top-1.5 text-[10px] text-background drop-shadow"
                  >
                    ▶
                  </span>
                )}
              </a>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-6 max-w-md text-sm leading-7 text-muted">
          The day-to-day lives on Instagram — fittings, offcuts, and the shots
          that never make the archive.{" "}
          <Link
            href={PROFILE}
            className="rounded-[2px] font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
          >
            Follow along
          </Link>
          .
        </p>
      )}
    </section>
  );
}
