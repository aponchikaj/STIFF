function Icon({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="square"
      className={className}
      aria-hidden
    >
      {children}
    </svg>
  );
}

export function IconChat({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 6h16v10H8l-4 4V6Z" />
    </Icon>
  );
}

export function IconMail({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M4 7h16v10H4V7Z" />
      <path d="m4 7 8 6 8-6" />
    </Icon>
  );
}

export function IconTasks({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M5 6h14M5 12h14M5 18h9" />
    </Icon>
  );
}

export function IconNotes({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M7 4h10v16H7V4Z" />
      <path d="M10 8h4M10 12h4M10 16h2" />
    </Icon>
  );
}

export function IconPeople({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="9" cy="8" r="2.5" />
      <circle cx="16" cy="9" r="2" />
      <path d="M4 18c.5-3 2.5-5 5-5s4.5 2 5 5" />
      <path d="M14 18c.3-2 1.5-3.2 3.2-3.2 1.6 0 2.8 1 3.3 3.2" />
    </Icon>
  );
}

export function IconRoles({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 3 20 7v5c0 5-3.5 8-8 9-4.5-1-8-4-8-9V7l8-4Z" />
    </Icon>
  );
}

export function IconPlus({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 5v14M5 12h14" />
    </Icon>
  );
}

export function IconClose({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Icon>
  );
}

export function IconPin({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <path d="M12 21v-6M8 4h8l-1.5 7H9.5L8 4Z" />
      <path d="M7 11h10" />
    </Icon>
  );
}

export function IconSearch({ className = "size-5" }: { className?: string }) {
  return (
    <Icon className={className}>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </Icon>
  );
}
