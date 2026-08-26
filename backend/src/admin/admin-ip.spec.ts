import { isIpAllowed, normaliseIp, parseAllowlist } from './admin-ip';

describe('admin IP allowlist', () => {
  describe('normaliseIp', () => {
    it('unwraps the IPv4-mapped IPv6 form a dual-stack listener reports', () => {
      expect(normaliseIp('::ffff:203.0.113.7')).toBe('203.0.113.7');
    });

    it('strips brackets and is case-insensitive', () => {
      expect(normaliseIp('[::1]')).toBe('::1');
      expect(normaliseIp('2001:DB8::1')).toBe('2001:db8::1');
    });

    it('treats blank input as no address', () => {
      expect(normaliseIp('  ')).toBeNull();
      expect(normaliseIp(undefined)).toBeNull();
    });
  });

  describe('parseAllowlist', () => {
    it('is empty when unset, which leaves the fence off', () => {
      expect(parseAllowlist(undefined)).toEqual([]);
      expect(parseAllowlist('')).toEqual([]);
      expect(parseAllowlist('  ,  ')).toEqual([]);
    });

    it('drops malformed entries instead of widening', () => {
      // A /33 or a 999 octet is a typo; letting it through as "match all"
      // would be the worst possible reading of it.
      expect(parseAllowlist('203.0.113.0/33')).toEqual([]);
      expect(parseAllowlist('999.0.0.1')).toEqual([]);
      expect(parseAllowlist('2001:db8::/32')).toEqual([]);
    });
  });

  describe('isIpAllowed', () => {
    it('allows everything when no rules are configured', () => {
      const rules = parseAllowlist('');
      expect(isIpAllowed('203.0.113.7', rules)).toBe(true);
      expect(isIpAllowed(undefined, rules)).toBe(true);
    });

    it('matches a bare address exactly', () => {
      const rules = parseAllowlist('203.0.113.7');
      expect(isIpAllowed('203.0.113.7', rules)).toBe(true);
      expect(isIpAllowed('203.0.113.8', rules)).toBe(false);
    });

    it('matches inside an IPv4 CIDR block and not outside it', () => {
      const rules = parseAllowlist('203.0.113.0/24');
      expect(isIpAllowed('203.0.113.1', rules)).toBe(true);
      expect(isIpAllowed('203.0.113.255', rules)).toBe(true);
      expect(isIpAllowed('203.0.114.1', rules)).toBe(false);
    });

    it('handles the /32 and /0 edges', () => {
      expect(isIpAllowed('10.0.0.1', parseAllowlist('10.0.0.1/32'))).toBe(true);
      expect(isIpAllowed('10.0.0.2', parseAllowlist('10.0.0.1/32'))).toBe(
        false,
      );
      expect(isIpAllowed('10.0.0.2', parseAllowlist('0.0.0.0/0'))).toBe(true);
    });

    it('matches an address arriving in IPv4-mapped form', () => {
      const rules = parseAllowlist('203.0.113.0/24');
      expect(isIpAllowed('::ffff:203.0.113.7', rules)).toBe(true);
    });

    it('matches a literal IPv6 address', () => {
      const rules = parseAllowlist('::1, 2001:db8::1');
      expect(isIpAllowed('[::1]', rules)).toBe(true);
      expect(isIpAllowed('2001:DB8::1', rules)).toBe(true);
      expect(isIpAllowed('2001:db8::2', rules)).toBe(false);
    });

    it('denies an unknown address once any rule exists', () => {
      const rules = parseAllowlist('203.0.113.0/24');
      expect(isIpAllowed(undefined, rules)).toBe(false);
      expect(isIpAllowed('', rules)).toBe(false);
    });
  });
});
