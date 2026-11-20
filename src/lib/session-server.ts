import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { licenseProof } from "@/lib/license-service";

/** Server-side login session, kept in a signed httpOnly cookie the browser cannot read or edit. */
export type ServerSession = {
  id: string;
  role: string;
  admin: boolean;
  exp: number;
  /** Admin id when this session is an admin "view as" of another user. */
  viewAsBy?: string | undefined;
};

const SESSION_COOKIE = "brandium_session";
/** Holds the admin's own signed session while an admin views as another user. */
export const RETURN_COOKIE = "brandium_admin_return";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

// shortcut: without SESSION_SECRET the key is random per server start, so a restart signs
// everyone out; set SESSION_SECRET in .env to keep sessions across restarts.
// shortcut: role and status are fixed until the cookie expires (7 days); move sessions to a
// MySQL table if a banned user must lose access at once.
const secretCache = globalThis as typeof globalThis & { __brandiumSessionSecret?: string };
const secret = () =>
  process.env["SESSION_SECRET"] ||
  (secretCache.__brandiumSessionSecret ??= randomBytes(32).toString("hex"));

// The license proof is part of the key: no valid license in production = no session can be signed.
const sign = (payload: string) =>
  createHmac("sha256", secret() + licenseProof())
    .update(payload)
    .digest("base64url");

const isHttps = (req: Request) =>
  req.headers.get("x-forwarded-proto") === "https" || req.url.startsWith("https:");

function cookieHeader(req: Request, name: string, value: string, maxAge: number) {
  return `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${
    isHttps(req) ? "; Secure" : ""
  }`;
}

/** Signed cookie value for a session (`payload.signature`). */
export function signSession(session: Omit<ServerSession, "exp">): string {
  const full: ServerSession = {
    ...session,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  };
  const payload = Buffer.from(JSON.stringify(full)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function setSessionCookie(
  req: Request,
  res: NextResponse,
  user: { id: string; role: string; admin: boolean; viewAsBy?: string | undefined },
) {
  res.headers.append(
    "Set-Cookie",
    cookieHeader(req, SESSION_COOKIE, signSession(user), MAX_AGE_SECONDS),
  );
}

/** Stores an already-signed cookie value (used to hand the admin's session back). */
export function setRawCookie(req: Request, res: NextResponse, name: string, value: string) {
  res.headers.append("Set-Cookie", cookieHeader(req, name, value, MAX_AGE_SECONDS));
}

export function clearRawCookie(req: Request, res: NextResponse, name: string) {
  res.headers.append("Set-Cookie", cookieHeader(req, name, "", 0));
}

export function clearSessionCookie(req: Request, res: NextResponse) {
  clearRawCookie(req, res, SESSION_COOKIE);
}

export function readCookie(req: Request, name: string): string | null {
  return (
    new RegExp(`(?:^|;\\s*)${name}=([^;]+)`).exec(req.headers.get("cookie") || "")?.[1] ?? null
  );
}

/** Checks the signature and expiry of a signed cookie value. */
export function verifySessionValue(raw: string | null): ServerSession | null {
  const [payload, signature] = (raw || "").split(".");
  if (!payload || !signature) return null;

  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;

  try {
    const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as ServerSession;
    return session.id && session.exp > Date.now() / 1000 ? session : null;
  } catch {
    return null;
  }
}

export function readSession(req: Request): ServerSession | null {
  return verifySessionValue(readCookie(req, SESSION_COOKIE));
}

export const unauthorized = () =>
  NextResponse.json(
    { success: false, error: "Not signed in.", response: "Not signed in." },
    { status: 401 },
  );

export const forbidden = () =>
  NextResponse.json(
    { success: false, error: "Admin access required.", response: "Admin access required." },
    { status: 403 },
  );
