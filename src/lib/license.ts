// Domain lock shared by the middleware (Edge) and the report route (Node). Web Crypto only.

export const LICENSED_HOST = "crm.brandiumagency.com";
export const ALLOWED_HOSTS = new Set([LICENSED_HOST, "localhost", "127.0.0.1", "[::1]"]);
export const LICENSE_REPORT_URL = `https://${LICENSED_HOST}/api/license/report`;

// shortcut: the key ships with the source, so anyone holding the source can forge a report and
// lock the real site (an admin unlocks it in Settings). Without a key, anyone on the internet could.
const REPORT_KEY = "2a41e6207676998157094221dc3b67a6a9314ceab93e16b9e4cf3059ffeee2a2";

const encoder = new TextEncoder();

const hmacKey = () =>
  crypto.subtle.importKey(
    "raw",
    encoder.encode(REPORT_KEY),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );

const toHex = (buf: ArrayBuffer) =>
  Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");

/** Host name without port, lower-cased, from a forwarded-host or host header value. */
export function hostOf(raw: string | null): string {
  const first = (raw || "").split(",")[0]?.trim().toLowerCase() || "";
  return first.startsWith("[") ? first.slice(0, first.indexOf("]") + 1) : first.split(":")[0] || "";
}

export async function signReport(host: string, ts: number): Promise<string> {
  return toHex(await crypto.subtle.sign("HMAC", await hmacKey(), encoder.encode(`${host}|${ts}`)));
}

/** True when the signature matches and the report is under 10 minutes old. */
export async function verifyReport(host: string, ts: number, sig: string): Promise<boolean> {
  if (!/^[0-9a-f]{64}$/.test(sig) || Math.abs(Date.now() - ts) > 10 * 60_000) return false;
  const bytes = new Uint8Array(sig.match(/../g)!.map((h) => parseInt(h, 16)));
  return crypto.subtle.verify("HMAC", await hmacKey(), bytes, encoder.encode(`${host}|${ts}`));
}
