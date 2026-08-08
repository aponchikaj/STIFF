function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-5"
      aria-hidden="true"
    >
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="size-5"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

const socials = [
  { name: "TikTok", href: "https://www.tiktok.com/@stiff", Icon: TikTokIcon },
  {
    name: "Instagram",
    href: "https://www.instagram.com/stiff",
    Icon: InstagramIcon,
  },
];

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-between bg-zinc-950 px-6 py-10 text-zinc-50">
      <span
        aria-hidden="true"
        className="animate-fade-up font-display text-5xl leading-none text-zinc-50 sm:text-6xl"
      >
        <span className="animate-spin-slow inline-block">*</span>
      </span>

      <main className="flex flex-col items-center gap-6 text-center">
        <h1 className="animate-fade-up font-display text-7xl uppercase leading-none tracking-tight sm:text-9xl [animation-delay:100ms]">
          Stiff
        </h1>
        <p className="animate-fade-up text-sm uppercase tracking-[0.45em] text-zinc-400 [animation-delay:200ms]">
          Coming soon
        </p>
        <div className="animate-fade-up mt-4 flex items-center gap-4 [animation-delay:300ms]">
          {socials.map(({ name, href, Icon }) => (
            <a
              key={name}
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`STIFF on ${name}`}
              className="flex size-11 items-center justify-center rounded-full border border-zinc-800 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
            >
              <Icon />
            </a>
          ))}
        </div>
      </main>

      <footer className="animate-fade-up flex items-center gap-2 text-xs tracking-widest text-zinc-500 [animation-delay:400ms]">
        <span aria-hidden="true" className="font-display text-sm">
          *
        </span>
        <span>2026 STIFF</span>
      </footer>
    </div>
  );
}
