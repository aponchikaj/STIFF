/**
 * Optional network fence in front of admin.stiff.ge.
 *
 * `ADMIN_IP_ALLOWLIST` is a comma-separated list of IPv4/IPv6 addresses and
 * IPv4 CIDR blocks. **Unset or empty means the fence is off** — that default is
 * deliberate: an allowlist that switches itself on the moment the variable is
 * misspelt locks the only admin out of the only tool that could fix it.
 *
 * Express is configured with `trust proxy` (Render terminates TLS), so
 * `req.ip` is already the client address rather than the proxy's.
 */

export interface AllowlistRule {
  /** IPv4 as a 32-bit int, or the normalised text form for IPv6. */
  readonly kind: 'v4' | 'text';
  readonly value: number | string;
  /** Only meaningful for 'v4'. 32 means "exact address". */
  readonly bits: number;
}

function ipv4ToInt(value: string): number | null {
  const parts = value.split('.');
  if (parts.length !== 4) return null;
  let out = 0;
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null;
    const n = Number(part);
    if (n > 255) return null;
    out = (out << 8) | n;
  }
  // `>>> 0` because the left shifts above produce a signed 32-bit result.
  return out >>> 0;
}

/**
 * Strips the forms an address arrives in but never matches as.
 * `::ffff:1.2.3.4` is how a dual-stack listener reports an IPv4 client, and
 * `[::1]:443` is how some proxies write a port onto one.
 */
export function normaliseIp(raw: string | undefined | null): string | null {
  if (!raw) return null;
  let value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.startsWith('[')) value = value.slice(1, value.indexOf(']'));
  if (value.startsWith('::ffff:')) value = value.slice(7);
  return value || null;
}

export function parseAllowlist(
  raw: string | undefined | null,
): AllowlistRule[] {
  if (!raw) return [];
  const rules: AllowlistRule[] = [];
  for (const entry of raw.split(',')) {
    const token = entry.trim().toLowerCase();
    if (!token) continue;

    const [address, maskText] = token.split('/');
    const asV4 = ipv4ToInt(address);

    if (asV4 !== null) {
      const bits = maskText === undefined ? 32 : Number(maskText);
      if (!Number.isInteger(bits) || bits < 0 || bits > 32) continue;
      rules.push({ kind: 'v4', value: asV4, bits });
      continue;
    }

    // Only an IPv6-shaped token gets the literal branch. A dotted quad that
    // failed the parse above is a typo, and keeping it would be actively
    // dangerous: a list of nothing but typos is still a non-empty list, which
    // switches the fence on and denies everyone including the person who has
    // to fix it.
    const normalised = normaliseIp(address);
    if (normalised && maskText === undefined && normalised.includes(':')) {
      rules.push({ kind: 'text', value: normalised, bits: 0 });
    }
  }
  return rules;
}

export function isIpAllowed(
  ip: string | undefined | null,
  rules: AllowlistRule[],
): boolean {
  if (rules.length === 0) return true; // fence disabled
  const candidate = normaliseIp(ip);
  if (!candidate) return false;

  const asV4 = ipv4ToInt(candidate);
  for (const rule of rules) {
    if (rule.kind === 'text') {
      if (rule.value === candidate) return true;
      continue;
    }
    if (asV4 === null) continue;
    if (rule.bits === 0) return true;
    // Shifting by 32 is a no-op in JS, so /32 is handled as its own case.
    const mask =
      rule.bits === 32 ? 0xffffffff : ~((1 << (32 - rule.bits)) - 1) >>> 0;
    if ((asV4 & mask) >>> 0 === ((rule.value as number) & mask) >>> 0) {
      return true;
    }
  }
  return false;
}
