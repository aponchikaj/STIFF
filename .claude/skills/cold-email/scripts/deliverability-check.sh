#!/usr/bin/env bash
#
# deliverability-check.sh — cold email deliverability preflight
#
# Usage:
#   ./deliverability-check.sh <domain> [dkim-selector ...]
#
# Examples:
#   ./deliverability-check.sh acmehq.com
#   ./deliverability-check.sh acmehq.com google s1
#
# Checks SPF, DKIM, and DMARC DNS records via dig and prints pass/fail
# with fix hints. If no DKIM selector is given, common selectors are tried
# (google, selector1, selector2, s1, s2, k1, k2, default, mail, dkim,
# smtp, mandrill, everlytickey1, zendesk1).
#
# Exit code: 0 if all checks pass, 1 otherwise.

set -u

if [ $# -lt 1 ]; then
  echo "Usage: $0 <domain> [dkim-selector ...]" >&2
  exit 2
fi

if ! command -v dig >/dev/null 2>&1; then
  echo "ERROR: 'dig' not found. Install bind/dnsutils (macOS ships it by default)." >&2
  exit 2
fi

DOMAIN="$1"
shift
SELECTORS=("$@")
if [ ${#SELECTORS[@]} -eq 0 ]; then
  SELECTORS=(google selector1 selector2 s1 s2 k1 k2 default mail dkim smtp mandrill everlytickey1 zendesk1)
fi

FAILURES=0

pass() { printf 'PASS  %s\n' "$1"; }
fail() { printf 'FAIL  %s\n' "$1"; printf '      fix: %s\n' "$2"; FAILURES=$((FAILURES + 1)); }
warn() { printf 'WARN  %s\n' "$1"; printf '      hint: %s\n' "$2"; }

txt_lookup() {
  # Print TXT record strings for a name, quotes stripped, chunks joined.
  dig +short TXT "$1" 2>/dev/null | sed -e 's/" "//g' -e 's/^"//' -e 's/"$//'
}

echo "Deliverability preflight for: $DOMAIN"
echo "----------------------------------------"

# ---- SPF ------------------------------------------------------------------
SPF_RECORDS="$(txt_lookup "$DOMAIN" | grep -i '^v=spf1' || true)"
SPF_COUNT=0
[ -n "$SPF_RECORDS" ] && SPF_COUNT="$(printf '%s\n' "$SPF_RECORDS" | wc -l | tr -d ' ')"

if [ "$SPF_COUNT" -eq 0 ]; then
  fail "SPF: no v=spf1 TXT record found" \
       "add a TXT record on $DOMAIN like: v=spf1 include:<your-esp-spf> ~all (e.g. include:_spf.google.com for Google Workspace)"
elif [ "$SPF_COUNT" -gt 1 ]; then
  fail "SPF: $SPF_COUNT SPF records found — multiple records are an automatic permerror" \
       "merge all includes into ONE v=spf1 record and delete the rest"
else
  case "$SPF_RECORDS" in
    *-all)  pass "SPF: $SPF_RECORDS" ;;
    *~all)  pass "SPF: $SPF_RECORDS" ;;
    *\?all) warn "SPF: record found but ends in ?all (neutral — provides no protection)" \
                 "change ?all to ~all (softfail) or -all (hardfail)"
            pass "SPF: $SPF_RECORDS" ;;
    *+all)  fail "SPF: record ends in +all — this authorizes the entire internet to send as you" \
                 "change +all to ~all or -all" ;;
    *)      warn "SPF: record has no 'all' mechanism" \
                 "end the record with ~all or -all so unauthorized servers fail"
            pass "SPF: $SPF_RECORDS" ;;
  esac
fi

# ---- DKIM -----------------------------------------------------------------
# A valid DKIM record must carry a non-empty public key: p=<base64>.
# An empty p= means the key was revoked and will not verify signatures.
DKIM_FOUND=""
DKIM_REVOKED=""
for sel in "${SELECTORS[@]}"; do
  rec="$(txt_lookup "${sel}._domainkey.${DOMAIN}" | grep -Ei 'v=DKIM1|k=rsa|p=' || true)"
  if [ -z "$rec" ]; then
    # Some providers publish DKIM as CNAME to their own record; follow it.
    cname="$(dig +short CNAME "${sel}._domainkey.${DOMAIN}" 2>/dev/null | head -1)"
    [ -n "$cname" ] && rec="$(txt_lookup "$cname" | grep -Ei 'p=' || true)"
  fi
  if [ -n "$rec" ]; then
    if printf '%s' "$rec" | tr -d ' ' | grep -Eq 'p=[A-Za-z0-9+/]'; then
      DKIM_FOUND="$sel"
      break
    else
      DKIM_REVOKED="$sel"
    fi
  fi
done

if [ -n "$DKIM_FOUND" ]; then
  pass "DKIM: key found at ${DKIM_FOUND}._domainkey.${DOMAIN}"
elif [ -n "$DKIM_REVOKED" ]; then
  fail "DKIM: record at ${DKIM_REVOKED}._domainkey.${DOMAIN} has an empty p= (revoked key)" \
       "re-enable DKIM in your ESP and publish the new public key it generates"
else
  fail "DKIM: no key found for selectors tried: ${SELECTORS[*]}" \
       "enable DKIM signing in your ESP, publish the selector record it gives you, then rerun with: $0 $DOMAIN <your-selector>"
fi

# ---- DMARC ----------------------------------------------------------------
DMARC_RECORD="$(txt_lookup "_dmarc.${DOMAIN}" | grep -i '^v=DMARC1' | head -1 || true)"

if [ -z "$DMARC_RECORD" ]; then
  fail "DMARC: no record at _dmarc.${DOMAIN}" \
       "add a TXT record on _dmarc.${DOMAIN}: v=DMARC1; p=none; rua=mailto:dmarc@${DOMAIN} (Gmail/Yahoo require DMARC for bulk senders)"
else
  policy="$(printf '%s' "$DMARC_RECORD" | tr -d ' ' | grep -oi 'p=[a-z]*' | head -1 | cut -d= -f2 | tr '[:upper:]' '[:lower:]')"
  case "$policy" in
    reject|quarantine)
      pass "DMARC: $DMARC_RECORD" ;;
    none)
      pass "DMARC: $DMARC_RECORD"
      warn "DMARC: policy is p=none (monitor only)" \
           "fine for warmup; move to p=quarantine once rua reports show aligned mail" ;;
    *)
      fail "DMARC: record present but no valid p= policy tag" \
           "set p=none, p=quarantine, or p=reject in the _dmarc record" ;;
  esac
  if ! printf '%s' "$DMARC_RECORD" | grep -qi 'rua='; then
    warn "DMARC: no rua= reporting address" \
         "add rua=mailto:dmarc@${DOMAIN} so you receive aggregate reports"
  fi
fi

# ---- Summary --------------------------------------------------------------
echo "----------------------------------------"
if [ "$FAILURES" -eq 0 ]; then
  echo "RESULT: PASS — SPF, DKIM, and DMARC are in place for $DOMAIN."
  echo "Next: warm the domain 2-4 weeks (start 10-20/day), keep bounces <2% and complaints <0.1%."
  exit 0
else
  echo "RESULT: FAIL — $FAILURES check(s) failed. Fix the records above before sending any cold email."
  exit 1
fi
