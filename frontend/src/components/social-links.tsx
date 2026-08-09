function TikTokIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className="size-4"
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
      className="size-4"
      aria-hidden="true"
    >
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

const socials = [
  {
    name: "TikTok",
    href: "https://www.tiktok.com/@stiff____",
    Icon: TikTokIcon,
  },
  {
    name: "Instagram",
    href: "https://www.instagram.com/stiff__________/",
    Icon: InstagramIcon,
  },
];

export function SocialLinks({ labels = true }: { labels?: boolean }) {
  return (
    <ul className="flex items-center gap-2">
      {socials.map(({ name, href, Icon }) => (
        <li key={name}>
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={labels ? undefined : `STIFF on ${name}`}
            className={
              labels
                ? "flex h-10 items-center gap-2 rounded-[2px] border border-subtle px-4 text-[11px] font-medium uppercase tracking-[0.2em] text-muted transition-colors hover:border-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
                : "flex size-10 items-center justify-center rounded-[2px] text-muted transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-muted"
            }
          >
            <Icon />
            {labels ? name : null}
          </a>
        </li>
      ))}
    </ul>
  );
}
