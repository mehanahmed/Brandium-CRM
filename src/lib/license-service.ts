// Server only. Brandium license (Seven Solution 7s model): a key signed with the owner's private
// Ed25519 key (scripts/license, never committed) and bound to one domain. The app holds only the
// public key, so nobody without the private key can make a key for another domain.
import { createHmac, verify } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const PUBLIC_KEY_PEM = `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEA1VU1EBosu4MW8SNvDrV1obEvFrZxh+v/3bZLv2NcN/o=
-----END PUBLIC KEY-----`;

const PREFIX = "BRLIC-";
const LICENSE_FILE = path.resolve(process.cwd(), ".license");

export type LicensePayload = {
  v: number;
  domain: string;
  client: string;
  type: string;
  iat: number;
  exp: number | null;
};

export type LicenseResult = {
  valid: boolean;
  error?: string;
  payload?: LicensePayload;
  signature?: string;
};

/** Host without protocol, path or port, lower-cased. */
export function normalizeHost(host: string | null | undefined): string {
  const first = (host || "").split(",")[0] || "";
  return (
    first
      .toLowerCase()
      .trim()
      .replace(/^https?:\/\//, "")
      .replace(/\/.*$/, "")
      .replace(/:\d+$/, "") || "localhost"
  );
}

export const requestHost = (headers: Headers) =>
  normalizeHost(headers.get("x-forwarded-host") || headers.get("host"));

const isLocalHost = (host: string) =>
  host === "localhost" || host === "127.0.0.1" || host === "[::1]" || host.endsWith(".localhost");

/** Development on this machine needs no key; production always does. */
const devBypass = (host: string) => process.env.NODE_ENV !== "production" && isLocalHost(host);

const domainMatches = (host: string, licensed: string) =>
  host === licensed || (licensed.startsWith("*.") && host.endsWith(licensed.slice(1)));

/** Checks the signature, expiry and (when given) that the key belongs to `host`. */
export function verifyLicenseKey(raw: string, host?: string): LicenseResult {
  const key = (raw || "").trim();
  if (!key.startsWith(PREFIX))
    return { valid: false, error: `Invalid license key. It must start with ${PREFIX}` };
  const [payloadB64, sigB64, extra] = key.slice(PREFIX.length).split(".");
  if (!payloadB64 || !sigB64 || extra !== undefined)
    return { valid: false, error: "Malformed license key." };

  const json = Buffer.from(payloadB64, "base64url").toString("utf8");
  let payload: LicensePayload;
  try {
    payload = JSON.parse(json) as LicensePayload;
  } catch {
    return { valid: false, error: "Corrupt license key." };
  }
  let signed = false;
  try {
    signed = verify(
      null,
      Buffer.from(json, "utf8"),
      PUBLIC_KEY_PEM,
      Buffer.from(sigB64, "base64url"),
    );
  } catch {
    signed = false;
  }
  if (!signed) return { valid: false, error: "License signature is invalid or tampered." };
  if (payload.exp && payload.exp < Date.now() / 1000) {
    return { valid: false, error: "License has expired.", payload };
  }
  const licensed = normalizeHost(payload.domain);
  if (host && !domainMatches(normalizeHost(host), licensed)) {
    return {
      valid: false,
      error: `License is for '${payload.domain}', not '${normalizeHost(host)}'.`,
      payload,
    };
  }
  return { valid: true, payload, signature: sigB64 };
}

/** The activated key: `.license` file (written by the /license page), else env LICENSE_KEY. */
export function getStoredLicenseKey(): string | null {
  try {
    const fromFile = fs.readFileSync(LICENSE_FILE, "utf8").trim();
    if (fromFile) return fromFile;
  } catch {
    // no file yet
  }
  return process.env["LICENSE_KEY"]?.trim() || null;
}

// The file is read at most once a second, not on every request.
const cache = globalThis as typeof globalThis & {
  __brandiumLicense?: { at: number; key: string | null };
};
function cachedKey(): string | null {
  const c = cache.__brandiumLicense;
  if (c && Date.now() - c.at < 1000) return c.key;
  const key = getStoredLicenseKey();
  cache.__brandiumLicense = { at: Date.now(), key };
  return key;
}

export function getLicenseStatus(host: string): LicenseResult {
  const key = cachedKey();
  if (key) {
    const res = verifyLicenseKey(key, host);
    if (res.valid || !devBypass(host)) return res;
  }
  if (devBypass(host)) return { valid: true, signature: "dev" };
  return { valid: false, error: "Brandium CRM is not activated for this domain." };
}

/** Saves a key after checking it belongs to `host`. */
export function activateLicense(raw: string, host: string): LicenseResult {
  const res = verifyLicenseKey(raw, host);
  if (!res.valid) return res;
  fs.writeFileSync(LICENSE_FILE, raw.trim(), { encoding: "utf8", mode: 0o600 });
  delete cache.__brandiumLicense;
  return res;
}

/**
 * Mixed into the session signing key (session-server.ts): without a validly signed license key
 * in production no session can be signed, so deleting the middleware check alone does not
 * bring the app back on another domain.
 */
export function licenseProof(): string {
  const key = cachedKey();
  const res = key ? verifyLicenseKey(key) : null;
  if (res?.valid && res.signature && res.payload) {
    return createHmac("sha256", res.signature)
      .update(`${normalizeHost(res.payload.domain)}:brandium-lock`)
      .digest("hex");
  }
  if (process.env.NODE_ENV !== "production") return "dev-proof";
  throw new Error("Brandium CRM is not activated. Open /license to activate it.");
}
