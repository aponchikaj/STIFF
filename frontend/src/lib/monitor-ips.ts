/**
 * UptimeRobot's published probe addresses.
 *
 * These exist to let the monitor past the staging Basic Auth gate — not for
 * CORS. CORS is a browser mechanism keyed on the `Origin` header; a server-side
 * monitor sends no `Origin`, so `enableCors` never applies to it.
 *
 * Source: https://uptimerobot.com/help/locations/ — re-check after UptimeRobot
 * announces new probe locations.
 */
const UPTIME_ROBOT_IPS = [
  "3.12.251.153",
  "3.20.63.178",
  "3.133.226.214",
  "3.149.57.90",
  "3.212.128.62",
  "5.161.61.238",
  "5.161.73.160",
  "5.161.75.7",
  "5.161.113.195",
  "5.161.117.52",
  "5.161.177.47",
  "5.161.194.92",
  "5.161.215.244",
  "18.116.205.62",
  "34.198.201.66",
  "45.55.123.175",
  "45.55.127.146",
  "52.15.147.27",
  "52.22.236.30",
  "52.87.72.16",
  "54.87.112.51",
  "54.167.223.174",
  "129.212.132.140",
  "134.199.240.137",
  "138.197.53.117",
  "138.197.53.138",
  "138.197.54.143",
  "138.197.54.247",
  "138.197.63.92",
  "143.244.221.177",
  "144.126.251.21",
  "178.156.181.172",
  "178.156.184.20",
  "178.156.185.127",
  "178.156.185.231",
  "178.156.187.238",
  "178.156.189.113",
  "178.156.189.249",
  "209.38.49.1",
  "209.38.49.206",
  "209.38.49.226",
  "209.38.51.43",
  "216.144.248.27",
  "216.144.248.28",
  "216.144.248.29",
];

/** Extra probes per environment, comma-separated, without redeploying code. */
function extraIps(): string[] {
  return (process.env.MONITOR_IPS ?? "")
    .split(",")
    .map((ip) => ip.trim())
    .filter(Boolean);
}

let cache: Set<string> | null = null;

function allowlist(): Set<string> {
  if (!cache) cache = new Set([...UPTIME_ROBOT_IPS, ...extraIps()]);
  return cache;
}

/**
 * Client IP as reported by the platform's proxy.
 *
 * `x-forwarded-for` is a chain; the left-most entry is the original client.
 * A client can forge that header, so this must never gate anything that
 * actually protects data — it only skips a staging password prompt.
 */
export function clientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return normalize(first);
  }
  const real = headers.get("x-real-ip");
  return real ? normalize(real.trim()) : null;
}

/** Strips the IPv6 mapping some proxies apply to IPv4 addresses. */
function normalize(ip: string): string {
  return ip.startsWith("::ffff:") ? ip.slice(7) : ip;
}

export function isMonitorIp(ip: string | null): boolean {
  return ip !== null && allowlist().has(ip);
}
